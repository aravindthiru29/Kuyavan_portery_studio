from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
from flask import Flask, request, jsonify, session, render_template
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import jwt
import os, random, string, uuid
from flask import send_from_directory

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
TEMPLATES_DIR = PROJECT_ROOT / 'templates'
STATIC_DIR = PROJECT_ROOT / 'static'
STATIC_ASSETS_DIR = STATIC_DIR / 'assets'
IS_VERCEL = bool(os.getenv('VERCEL'))
DEFAULT_DB_PATH = (Path('/tmp') / 'kuyavan.db') if IS_VERCEL else (PROJECT_ROOT / 'instance' / 'kuyavan.db')
DEFAULT_UPLOADS_DIR = (Path('/tmp') / 'kuyavan-uploads') if IS_VERCEL else (PROJECT_ROOT / 'uploads')
UPLOADS_DIR = Path(os.getenv('UPLOADS_DIR', str(DEFAULT_UPLOADS_DIR)))
SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL') or f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"

app = Flask(
    __name__,
    template_folder=str(TEMPLATES_DIR),
    static_folder=str(STATIC_DIR),
    static_url_path='/static'
)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'kuyavan-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SECURE'] = IS_VERCEL
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

CORS(app, supports_credentials=True, origins=['*'])
db = SQLAlchemy(app)
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

# ─── MODELS ───────────────────────────────────────────────────────

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    orders = db.relationship('Order', backref='user', lazy=True)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    price = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)  # pots/toys/decor
    stock = db.Column(db.Integer, default=0)
    artisan = db.Column(db.String(100))
    material = db.Column(db.String(100))
    size = db.Column(db.String(100))
    care = db.Column(db.String(200))
    description = db.Column(db.Text)
    stars = db.Column(db.Integer, default=5)
    visible = db.Column(db.Boolean, default=True)
    type = db.Column(db.String(50), default='large')  # large/small/toy/decor
    image_path = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        # Calculate review statistics
        review_count = len(self.reviews)
        avg_rating = 0
        if review_count > 0:
            avg_rating = sum(r.rating for r in self.reviews) / review_count
        
        return {
            'id': self.id, 'name': self.name, 'price': self.price,
            'category': self.category, 'stock': self.stock,
            'artisan': self.artisan, 'material': self.material,
            'size': self.size, 'care': self.care, 'desc': self.description,
            'stars': self.stars, 'visible': self.visible, 'type': self.type,
            'image_url': self.image_path,
            'review_count': review_count,
            'avg_rating': round(avg_rating, 1)
        }

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_code = db.Column(db.String(30), unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    customer_name = db.Column(db.String(150))
    customer_email = db.Column(db.String(150))
    customer_phone = db.Column(db.String(30))
    address = db.Column(db.Text)
    city = db.Column(db.String(100))
    state = db.Column(db.String(100))
    pincode = db.Column(db.String(20))
    total = db.Column(db.Float)
    payment_method = db.Column(db.String(30))  # online/cod
    payment_status = db.Column(db.String(30), default='pending')  # pending/paid/failed
    order_status = db.Column(db.String(30), default='processing')  # processing/shipped/delivered/cancelled
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id, 'order_code': self.order_code,
            'customer_name': self.customer_name, 'customer_email': self.customer_email,
            'customer_phone': self.customer_phone,
            'address': self.address, 'city': self.city, 'state': self.state, 'pincode': self.pincode,
            'total': self.total, 'payment_method': self.payment_method,
            'payment_status': self.payment_status, 'order_status': self.order_status,
            'created_at': self.created_at.strftime('%d %b %Y, %I:%M %p'),
            'items': [i.to_dict() for i in self.items]
        }

class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    product_id = db.Column(db.Integer)
    product_name = db.Column(db.String(200))
    product_type = db.Column(db.String(50))
    price = db.Column(db.Float)
    quantity = db.Column(db.Integer)

    def to_dict(self):
        return {
            'product_id': self.product_id, 'product_name': self.product_name,
            'product_type': self.product_type, 'price': self.price, 'quantity': self.quantity
        }

class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)  # 1-5 stars
    title = db.Column(db.String(200))
    content = db.Column(db.Text, nullable=False)
    verified_purchase = db.Column(db.Boolean, default=False)
    helpful_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    product = db.relationship('Product', backref=db.backref('reviews', lazy=True, cascade='all, delete-orphan'))
    user = db.relationship('User', backref=db.backref('reviews', lazy=True))

    def to_dict(self):
        return {
            'id': self.id, 'product_id': self.product_id, 'user_id': self.user_id,
            'rating': self.rating, 'title': self.title, 'content': self.content,
            'verified_purchase': self.verified_purchase, 'helpful_count': self.helpful_count,
            'created_at': self.created_at.strftime('%d %b %Y'),
            'user_name': self.user.name if self.user else 'Anonymous'
        }

# ─── HELPERS ──────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/uploads/<path:filename>')
def uploaded_assets(filename):
    return send_from_directory(UPLOADS_DIR, filename)


@app.route('/<path:path>')
def frontend_routes(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    if path.startswith('static/'):
        return send_from_directory(STATIC_DIR, path.replace('static/', '', 1))
    if path.startswith('uploads/'):
        return send_from_directory(UPLOADS_DIR, path.replace('uploads/', '', 1))
    if path.startswith('assets/uploads/'):
        return send_from_directory(UPLOADS_DIR, path.replace('assets/uploads/', '', 1))
    return render_template('index.html')


def gen_order_code():
    year = datetime.utcnow().year
    suffix = ''.join(random.choices(string.digits, k=4))
    return f'KUY-{year}-{suffix}'

def require_admin():
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            if data.get('is_admin'):
                return None
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
            
    # Fallback to session check for backward compatibility or strictness
    if not session.get('is_admin'):
        return jsonify({'error': 'Admin token or access required'}), 403
    return None


def ensure_product_schema():
    inspector = db.inspect(db.engine)
    columns = {column['name'] for column in inspector.get_columns('product')}
    if 'image_path' not in columns:
        db.session.execute(db.text('ALTER TABLE product ADD COLUMN image_path VARCHAR(255)'))
        db.session.commit()


def get_request_data():
    return request.form if request.form else (request.get_json(silent=True) or {})


def parse_bool(value, default=True):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


def save_product_image(file_storage):
    if not file_storage or not file_storage.filename:
        return None
    ext = file_storage.filename.rsplit('.', 1)[-1].lower() if '.' in file_storage.filename else ''
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError('Upload a valid image file: png, jpg, jpeg, gif, or webp')
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    base_name = secure_filename(file_storage.filename.rsplit('.', 1)[0]) or 'product'
    filename = f"{base_name}-{uuid.uuid4().hex[:10]}.{ext}"
    file_path = os.path.join(UPLOADS_DIR, filename)
    file_storage.save(file_path)
    if IS_VERCEL:
        return f'/uploads/{filename}'
    return f'/assets/uploads/{filename}'


def delete_product_image(image_path):
    if not image_path:
        return
    if image_path.startswith('/assets/uploads/'):
        filename = image_path.replace('/assets/uploads/', '', 1)
    elif image_path.startswith('/uploads/'):
        filename = image_path.replace('/uploads/', '', 1)
    else:
        return
    file_path = os.path.join(UPLOADS_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)

def seed_data():
    """Seed admin user if DB is empty."""
    admin_email = os.getenv('ADMIN_EMAIL', 'admin@kuyavan.in')
    if User.query.filter_by(is_admin=True).first():
        return
    admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
    admin = User(name='Admin', email=admin_email,
                 password_hash=generate_password_hash(admin_password), is_admin=True)
    db.session.add(admin)
    db.session.commit()

# ─── AUTH ROUTES ──────────────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required'}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409
    user = User(name=data.get('name',''), email=data['email'],
                password_hash=generate_password_hash(data['password']))
    db.session.add(user)
    db.session.commit()
    session['user_id'] = user.id
    session['user_name'] = user.name
    session['is_admin'] = False
    return jsonify({'message': 'Registered successfully', 'user': {'id': user.id, 'name': user.name, 'email': user.email}}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data.get('email','')).first()
    if not user or not check_password_hash(user.password_hash, data.get('password','')):
        return jsonify({'error': 'Invalid email or password'}), 401
    session['user_id'] = user.id
    session['user_name'] = user.name
    session['is_admin'] = user.is_admin
    
    response_data = {'message': 'Login successful', 'user': {'id': user.id, 'name': user.name, 'email': user.email, 'is_admin': user.is_admin}}
    
    if user.is_admin:
        token = jwt.encode({
            'user_id': user.id,
            'is_admin': True,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        response_data['token'] = token
        
    return jsonify(response_data)

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'})

@app.route('/api/auth/me', methods=['GET'])
def me():
    if not session.get('user_id'):
        return jsonify({'logged_in': False}), 200
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'logged_in': False}), 200
    return jsonify({'logged_in': True, 'user': {'id': user.id, 'name': user.name, 'email': user.email, 'is_admin': user.is_admin}})

# ─── PRODUCT ROUTES ───────────────────────────────────────────────

@app.route('/api/products', methods=['GET'])
def get_products():
    category = request.args.get('category')
    search = request.args.get('search', '')
    show_hidden = request.args.get('show_hidden') == '1' and session.get('is_admin')
    query = Product.query
    if not show_hidden:
        query = query.filter_by(visible=True)
    if category and category != 'all':
        query = query.filter_by(category=category)
    if search:
        query = query.filter(Product.name.ilike(f'%{search}%') | Product.artisan.ilike(f'%{search}%'))
    return jsonify([p.to_dict() for p in query.all()])

@app.route('/api/products/<int:pid>', methods=['GET'])
def get_product(pid):
    p = Product.query.get_or_404(pid)
    return jsonify(p.to_dict())

@app.route('/api/products', methods=['POST'])
def create_product():
    err = require_admin()
    if err: return err
    data = get_request_data()
    if not data.get('name') or not data.get('price'):
        return jsonify({'error': 'Name and price required'}), 400
    type_map = {'pots': 'large', 'toys': 'toy', 'decor': 'decor'}
    try:
        image_path = save_product_image(request.files.get('image'))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    p = Product(
        name=data['name'], price=float(data['price']),
        category=data.get('category', 'pots'),
        stock=int(data.get('stock', 0)),
        artisan=data.get('artisan', 'Artisan'),
        material=data.get('material', 'Terracotta'),
        size=data.get('size', 'Standard'),
        care=data.get('care', 'Handle with care'),
        description=data.get('desc', ''),
        stars=int(data.get('stars', 5)),
        visible=parse_bool(data.get('visible'), True),
        image_path=image_path,
        type=type_map.get(data.get('category', 'pots'), 'large')
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201

@app.route('/api/products/<int:pid>', methods=['PUT'])
def update_product(pid):
    err = require_admin()
    if err: return err
    p = Product.query.get_or_404(pid)
    data = get_request_data()
    type_map = {'pots': 'large', 'toys': 'toy', 'decor': 'decor'}
    try:
        new_image_path = save_product_image(request.files.get('image'))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    if 'name' in data: p.name = data['name']
    if 'price' in data: p.price = float(data['price'])
    if 'category' in data:
        p.category = data['category']
        p.type = type_map.get(data['category'], p.type)
    if 'stock' in data: p.stock = int(data['stock'])
    if 'artisan' in data: p.artisan = data['artisan']
    if 'material' in data: p.material = data['material']
    if 'size' in data: p.size = data['size']
    if 'care' in data: p.care = data['care']
    if 'desc' in data: p.description = data['desc']
    if 'stars' in data: p.stars = int(data['stars'])
    if 'visible' in data: p.visible = parse_bool(data['visible'], p.visible)
    if new_image_path:
        delete_product_image(p.image_path)
        p.image_path = new_image_path
    db.session.commit()
    return jsonify(p.to_dict())

@app.route('/api/products/<int:pid>', methods=['DELETE'])
def delete_product(pid):
    err = require_admin()
    if err: return err
    p = Product.query.get_or_404(pid)
    delete_product_image(p.image_path)
    db.session.delete(p)
    db.session.commit()
    return jsonify({'message': f'{p.name} deleted'})

# ─── REVIEW ROUTES ─────────────────────────────────────────────────

@app.route('/api/products/<int:pid>/reviews', methods=['GET'])
def get_product_reviews(pid):
    p = Product.query.get_or_404(pid)
    reviews = Review.query.filter_by(product_id=pid).order_by(Review.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reviews])

@app.route('/api/products/<int:pid>/reviews', methods=['POST'])
def create_review(pid):
    if not session.get('user_id'):
        return jsonify({'error': 'Login required to write a review'}), 401
    
    p = Product.query.get_or_404(pid)
    user_id = session['user_id']
    data = request.get_json()
    
    if not data.get('rating') or not data.get('content'):
        return jsonify({'error': 'Rating and content are required'}), 400
    
    if not (1 <= int(data['rating']) <= 5):
        return jsonify({'error': 'Rating must be between 1 and 5'}), 400
    
    # Check if user already reviewed this product
    existing_review = Review.query.filter_by(product_id=pid, user_id=user_id).first()
    if existing_review:
        return jsonify({'error': 'You have already reviewed this product'}), 409
    
    # Check if user has purchased this product (for verified purchase badge)
    verified_purchase = False
    user_orders = Order.query.filter_by(user_id=user_id).all()
    for order in user_orders:
        for item in order.items:
            if item.product_id == pid:
                verified_purchase = True
                break
        if verified_purchase:
            break
    
    review = Review(
        product_id=pid,
        user_id=user_id,
        rating=int(data['rating']),
        title=data.get('title', ''),
        content=data['content'],
        verified_purchase=verified_purchase
    )
    db.session.add(review)
    db.session.commit()
    
    return jsonify(review.to_dict()), 201

@app.route('/api/reviews/<int:review_id>/helpful', methods=['POST'])
def mark_review_helpful(review_id):
    if not session.get('user_id'):
        return jsonify({'error': 'Login required'}), 401
    
    review = Review.query.get_or_404(review_id)
    review.helpful_count += 1
    db.session.commit()
    
    return jsonify({'helpful_count': review.helpful_count})

# ─── CART ROUTES (session-based) ─────────────────────────────────

@app.route('/api/cart', methods=['GET'])
def get_cart():
    cart = session.get('cart', [])
    result = []
    for item in cart:
        p = Product.query.get(item['id'])
        if p:
            result.append({'id': p.id, 'name': p.name, 'price': p.price,
                           'type': p.type, 'qty': item['qty'], 'stock': p.stock})
    return jsonify(result)

@app.route('/api/cart', methods=['POST'])
def add_to_cart():
    data = request.json
    pid = int(data.get('id', 0))
    qty = int(data.get('qty', 1))
    p = Product.query.get(pid)
    if not p:
        return jsonify({'error': 'Product not found'}), 404
    cart = session.get('cart', [])
    existing = next((i for i in cart if i['id'] == pid), None)
    if existing:
        existing['qty'] = min(existing['qty'] + qty, p.stock)
    else:
        cart.append({'id': pid, 'qty': min(qty, p.stock)})
    session['cart'] = cart
    session.modified = True
    return jsonify({'message': f'{p.name} added to cart', 'cart_count': sum(i['qty'] for i in cart)})

@app.route('/api/cart/<int:pid>', methods=['PUT'])
def update_cart(pid):
    data = request.json
    qty = int(data.get('qty', 1))
    cart = session.get('cart', [])
    p = Product.query.get(pid)
    if not p:
        return jsonify({'error': 'Product not found'}), 404
    item = next((i for i in cart if i['id'] == pid), None)
    if not item:
        return jsonify({'error': 'Item not in cart'}), 404
    if qty <= 0:
        cart = [i for i in cart if i['id'] != pid]
    else:
        item['qty'] = min(qty, p.stock)
    session['cart'] = cart
    session.modified = True
    return jsonify({'message': 'Cart updated', 'cart_count': sum(i['qty'] for i in cart)})

@app.route('/api/cart/<int:pid>', methods=['DELETE'])
def remove_from_cart(pid):
    cart = session.get('cart', [])
    cart = [i for i in cart if i['id'] != pid]
    session['cart'] = cart
    session.modified = True
    return jsonify({'message': 'Item removed', 'cart_count': sum(i['qty'] for i in cart)})

@app.route('/api/cart/count', methods=['GET'])
def cart_count():
    cart = session.get('cart', [])
    return jsonify({'count': sum(i['qty'] for i in cart)})

# ─── ORDER ROUTES ────

@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.json
    cart = session.get('cart', [])
    if not cart:
        return jsonify({'error': 'Cart is empty'}), 400

    # Validate required fields
    required = ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'pincode']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    # Build order items and calculate total
    order_items = []
    total = 0
    for cart_item in cart:
        p = Product.query.get(cart_item['id'])
        if not p:
            continue
        if p.stock < cart_item['qty']:
            return jsonify({'error': f'Insufficient stock for {p.name}'}), 400
        item_total = p.price * cart_item['qty']
        total += item_total
        order_items.append(OrderItem(
            product_id=p.id, product_name=p.name,
            product_type=p.type, price=p.price, quantity=cart_item['qty']
        ))
        p.stock -= cart_item['qty']  # Deduct stock

    # Generate unique order code
    code = gen_order_code()
    while Order.query.filter_by(order_code=code).first():
        code = gen_order_code()

    order = Order(
        order_code=code,
        user_id=session.get('user_id'),
        customer_name=f"{data['first_name']} {data['last_name']}",
        customer_email=data['email'],
        customer_phone=data['phone'],
        address=data['address'],
        city=data['city'],
        state=data['state'],
        pincode=data['pincode'],
        total=total,
        payment_method=data.get('payment_method', 'online'),
        payment_status='paid' if data.get('payment_method') == 'online' else 'pending',
        order_status='processing',
        notes=data.get('notes', ''),
        items=order_items
    )
    db.session.add(order)
    db.session.commit()

    # Clear cart after order
    session['cart'] = []
    session.modified = True

    return jsonify({'message': 'Order placed!', 'order_code': code, 'total': total}), 201

# ─── ADMIN ROUTES ────

@app.route('/api/admin/orders', methods=['GET'])
def admin_orders():
    err = require_admin()
    if err: return err
    status = request.args.get('status')
    query = Order.query.order_by(Order.created_at.desc())
    if status:
        query = query.filter_by(order_status=status)
    return jsonify([o.to_dict() for o in query.all()])

@app.route('/api/admin/orders/<int:oid>', methods=['PUT'])
def update_order(oid):
    err = require_admin()
    if err: return err
    o = Order.query.get_or_404(oid)
    data = request.json
    if 'order_status' in data:
        o.order_status = data['order_status']
    if 'payment_status' in data:
        o.payment_status = data['payment_status']
    db.session.commit()
    return jsonify(o.to_dict())

@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    err = require_admin()
    if err: return err
    total_orders = Order.query.count()
    total_revenue = db.session.query(db.func.sum(Order.total)).scalar() or 0
    total_products = Product.query.count()
    total_customers = User.query.filter_by(is_admin=False).count()
    recent = Order.query.order_by(Order.created_at.desc()).limit(5).all()
    low_stock = Product.query.filter(Product.stock <= 3).all()
    return jsonify({
        'total_orders': total_orders,
        'total_revenue': round(total_revenue, 2),
        'total_products': total_products,
        'total_customers': total_customers,
        'recent_orders': [o.to_dict() for o in recent],
        'low_stock': [p.to_dict() for p in low_stock]
    })

# ─── INIT ─────────────────────────────────────────────────────────

with app.app_context():
    os.makedirs(DEFAULT_DB_PATH.parent, exist_ok=True)
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    db.create_all()
    ensure_product_schema()
    seed_data()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
