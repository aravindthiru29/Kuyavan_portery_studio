//  CONFIG — Change API_BASE to match your Flask server URL
const API_BASE = window.location.origin;
const PAGE_ROUTES = {
  home: '/',
  shop: '/shop',
  checkout: '/checkout',
  success: '/success',
  'admin-login': '/admin/login',
  admin: '/admin'
};

// ─── SVG HELPERS ─────────────────────────────────────────────────
function getPotHtml(type, fill='#C4622D', size=80) {
  if(type==='large'||type==='pots') return `<svg viewBox="0 0 80 100" width="${size}" height="${size*1.25}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="40" cy="88" rx="28" ry="5" fill="rgba(0,0,0,0.1)"/><path d="M18 78 Q14 55 16 35 Q18 15 40 12 Q62 15 64 35 Q66 55 62 78 Z" fill="${fill}"/><ellipse cx="40" cy="14" rx="18" ry="5" fill="rgba(0,0,0,0.15)"/><ellipse cx="40" cy="78" rx="23" ry="5" fill="rgba(0,0,0,0.12)"/><path d="M22 45 Q40 38 58 45" fill="none" stroke="rgba(255,200,120,0.4)" stroke-width="1.5"/><path d="M20 58 Q40 51 60 58" fill="none" stroke="rgba(255,200,120,0.4)" stroke-width="1.5"/><circle cx="33" cy="30" r="3" fill="rgba(255,200,120,0.5)"/><circle cx="48" cy="34" r="2.5" fill="rgba(255,200,120,0.5)"/></svg>`;
  if(type==='small') return `<svg viewBox="0 0 60 70" width="${size}" height="${size*1.2}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="30" cy="64" rx="20" ry="4" fill="rgba(0,0,0,0.1)"/><path d="M14 56 Q12 42 14 28 Q16 10 30 8 Q44 10 46 28 Q48 42 46 56 Z" fill="${fill}"/><ellipse cx="30" cy="10" rx="13" ry="4" fill="rgba(0,0,0,0.15)"/><ellipse cx="30" cy="56" rx="17" ry="4" fill="rgba(0,0,0,0.12)"/><path d="M17 36 Q30 30 43 36" fill="none" stroke="rgba(255,200,120,0.4)" stroke-width="1.2"/></svg>`;
  if(type==='toy'||type==='toys') return `<svg viewBox="0 0 60 80" width="${size}" height="${size*1.3}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="30" cy="72" rx="18" ry="4" fill="rgba(0,0,0,0.1)"/><ellipse cx="30" cy="32" rx="22" ry="22" fill="${fill}"/><path d="M26 60 Q28 66 30 68 Q32 66 34 60 Q36 54 34 52 Q30 50 26 52 Z" fill="${fill}"/><circle cx="24" cy="28" r="3" fill="rgba(255,255,255,0.5)"/><circle cx="36" cy="28" r="3" fill="rgba(255,255,255,0.5)"/><path d="M24 38 Q30 43 36 38" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round"/></svg>`;
  return `<svg viewBox="0 0 70 90" width="${size}" height="${size*1.3}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="35" cy="82" rx="22" ry="5" fill="rgba(0,0,0,0.1)"/><path d="M20 72 Q16 55 18 38 Q20 18 35 15 Q50 18 52 38 Q54 55 50 72 Z" fill="${fill}"/><ellipse cx="35" cy="17" rx="15" ry="5" fill="rgba(0,0,0,0.15)"/><ellipse cx="35" cy="72" rx="20" ry="5" fill="rgba(0,0,0,0.12)"/><circle cx="35" cy="42" r="8" fill="none" stroke="rgba(255,200,120,0.5)" stroke-width="1.5"/><path d="M35 34 L35 50 M27 42 L43 42" stroke="rgba(255,200,120,0.4)" stroke-width="1.2"/></svg>`;
}
function getBg(type){return type==='large'||type==='pots'||type==='small'?'#FFF0E8':type==='toy'||type==='toys'?'#FFF5E0':'#F0F4E8';}
function getProductMedia(p, size=100, className='') {
  if(p.image_url && !p.image_url.includes('Minimalist_Digital_Banner')) {
    return `<img src="${p.image_url}" alt="${p.name}" class="${className}" onload="this.style.opacity='1'" onerror="this.style.display='none'; this.parentElement.innerHTML=getPotHtml('${p.type}', '#C4622D', ${size})">`;
  }
  return getPotHtml(p.type,'#C4622D',size);
}

// ─── API HELPER ───────────────────────────────────────────────────
async function api(path, options={}) {
  try {
    const headers = {...options.headers};
    if(!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const token = localStorage.getItem('admin_token');
    if(token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API_BASE+path, {
      credentials: 'include',
      headers,
      ...options
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Server error');
    return data;
  } catch(e) {
    throw e;
  }
}

// ─── STATE ────────────────────────────────────────────────────────
let currentPage='home', prevPage='home', shopCategory='all', cartItems=[];
let currentUser=null, modalProdStars=5, deleteProdId=null, currentReviewRating=0;

// ─── INIT ─────────────────────────────────────────────────────────
async function init() {
  try {
    const me = await api('/api/auth/me');
    if(me.logged_in) setUser(me.user);
  } catch(e){}
  initHeroArt();
  initLogoFallbacks();
  loadCartCount();
  loadFeatured();
  await handleRouteChange(true);
  window.addEventListener('popstate', () => { handleRouteChange(false); });
}

function setUser(user) {
  currentUser = user;
  const btn = document.getElementById('nav-auth-btn');
  if(user) { btn.textContent = '👤 '+user.name.split(' ')[0]; btn.onclick = logoutUser; }
  else { btn.textContent = 'Login / Register'; btn.onclick = openAuthModal; }
  
  const adminLink = document.getElementById('nav-admin-link');
  if (adminLink) {
    adminLink.style.display = (user && user.is_admin) ? 'inline-block' : 'none';
  }
}

function initHeroArt() {
  const heroTiles = [
    ['hero-art-large', 'large'],
    ['hero-art-toy', 'toy'],
    ['hero-art-decor', 'decor'],
    ['hero-art-small', 'small']
  ];
  heroTiles.forEach(([id, type]) => {
    const el = document.getElementById(id);
    if(el) el.innerHTML = getPotHtml(type, 'rgba(255,255,255,0.85)', 80);
  });
}

function initLogoFallbacks() {
  document.querySelectorAll('.brand-logo, .footer-brand-logo').forEach(img => {
    img.addEventListener('error', () => {
      img.style.display = 'none';
      if(img.parentElement.querySelector('.logo-fallback')) return;
      const fallback = document.createElement('span');
      fallback.className = 'logo-fallback';
      fallback.textContent = 'KP';
      img.parentElement.appendChild(fallback);
    }, { once: true });
  });
}

// ─── PAGE ROUTING ─────────────────────────────────────────────────
function updateHistory(path, state={}, replace=false) {
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method](state, '', path);
}

function getPathForPage(page) {
  return PAGE_ROUTES[page] || '/';
}

function setActiveShopCategory() {
  const tabs = document.querySelectorAll('#shop-tabs .tab-btn');
  tabs.forEach(btn => btn.classList.remove('active'));
  const labels = {
    all: 'All',
    pots: 'Clay Pots',
    toys: 'Clay Toys',
    decor: 'Terracotta Decor'
  };
  const activeTab = Array.from(tabs).find(btn => btn.textContent.trim() === labels[shopCategory]);
  if(activeTab) activeTab.classList.add('active');
}

async function handleRouteChange(replace=false) {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if(path.startsWith('/products/')) {
    const id = Number(path.split('/').pop());
    if(id) {
      await viewProduct(id, { pushState: false });
      if(replace) updateHistory(`/products/${id}`, { page: 'detail', productId: id }, true);
      return;
    }
  }

  let page = Object.entries(PAGE_ROUTES).find(([, route]) => route === path)?.[0] || 'home';
  if (page === 'admin' && (!currentUser || !currentUser.is_admin)) {
    page = 'admin-login';
  }
  showPage(page, { pushState: false });
  if(replace) updateHistory(getPathForPage(page), { page }, true);
}

function showPage(page, options={}) {
  const { pushState=true } = options;
  if (page === 'admin' && (!currentUser || !currentUser.is_admin)) {
    page = 'admin-login';
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  const hideNav = page==='admin'||page==='admin-login';
  document.getElementById('main-nav').style.display = hideNav?'none':'';
  prevPage=currentPage; currentPage=page;
  if(pushState && page!=='detail') updateHistory(getPathForPage(page), { page });
  window.scrollTo(0,0);
  if(page==='shop') {
    setActiveShopCategory();
    loadShopProducts();
  }
  if(page==='checkout') renderCheckoutSummary();
  if(page==='admin') loadAdminDashboard();
}
function goBack(){showPage(prevPage||'shop');}
function scrollToStory(){if(currentPage!=='home')showPage('home');setTimeout(()=>document.getElementById('our-story').scrollIntoView({behavior:'smooth'}),150);}
function filterCategory(cat){shopCategory=cat;showPage('shop');}

// ─── PRODUCTS ─────────────────────────────────────────────────────
function renderProductCard(p) {
  return `<div class="product-card" onclick="viewProduct(${p.id})">
    <div class="product-img" style="background:${getBg(p.type)}">
      ${getProductMedia(p,80)}
      <span class="product-badge badge-handmade">Handmade</span>
      ${p.stock<=3?`<span class="product-badge badge-stock" style="top:12px;left:auto;right:12px;">Only ${p.stock} left</span>`:''}
    </div>
    <div class="product-info">
      <div class="star-rating">${'★'.repeat(Number(p.stars)||5)}${'☆'.repeat(5-(Number(p.stars)||5))}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-artisan">by <span>${p.artisan||'Artisan'}</span></div>
      <div class="product-footer">
        <div class="product-price">₹${Number(p.price).toLocaleString('en-IN')} <small>/ piece</small></div>
        <button class="add-to-cart" onclick="event.stopPropagation();addToCart(${p.id},'${p.name}')">Add to Cart</button>
      </div>
    </div>
  </div>`;
}

async function loadFeatured() {
  const grid = document.getElementById('featured-grid');
  console.log('loadFeatured called');
  try {
    const prods = await api('/api/products');
    console.log('Products loaded:', prods);
    console.log('Product stars values:', prods.map(p => ({name: p.name, stars: p.stars, type: typeof p.stars})));
    const featured = prods.filter(p=>Number(p.stars)===5).slice(0,4);
    console.log('Featured products:', featured);
    console.log('Featured count:', featured.length);
    grid.innerHTML = featured.length ? featured.map(renderProductCard).join('') : '<p style="grid-column:1/-1;text-align:center;color:var(--muted);padding:3rem;">No products yet.</p>';
    console.log('Featured grid HTML updated');
  } catch(e){ 
    console.error('Error loading featured:', e);
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--muted);padding:2rem;">Could not load products. Is the Flask server running?<br><small style="font-size:.8rem;">${e.message}</small></p>`; 
  }
}

async function loadShopProducts() {
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--muted);">Loading...</div>';
  try {
    const search = document.getElementById('search-input')?.value || '';
    const params = new URLSearchParams();
    if(shopCategory!=='all') params.set('category', shopCategory);
    if(search) params.set('search', search);
    const prods = await api('/api/products?'+params);
    grid.innerHTML = prods.length ? prods.map(renderProductCard).join('') : '<p style="grid-column:1/-1;text-align:center;color:var(--muted);padding:3rem;">No products found.</p>';
  } catch(e){ grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted);">Could not connect to server.<br><small>${e.message}</small></p>`; }
}

function setCategory(cat, btn) {
  shopCategory = cat;
  document.querySelectorAll('#shop-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  loadShopProducts();
}

let searchTimeout;
function filterProducts(){ clearTimeout(searchTimeout); searchTimeout=setTimeout(loadShopProducts,350); }

async function viewProduct(id, options={}) {
  const { pushState=true } = options;
  console.log('viewProduct called with id:', id);
  try {
    const p = await api('/api/products/'+id);
    console.log('Product loaded:', p);
    const reviews = await api('/api/products/'+id+'/reviews');
    console.log('Reviews loaded:', reviews);
    const catLabels = {pots:'Clay Pots', toys:'Clay Toys', decor:'Terracotta Decor'};
    
    // Calculate rating breakdown
    const ratingBreakdown = [5,4,3,2,1].map(rating => ({
      rating,
      count: reviews.filter(rev => rev.rating === rating).length,
      percentage: reviews.length > 0 ? (reviews.filter(rev => rev.rating === rating).length / reviews.length * 100).toFixed(0) : 0
    }));
    
    document.getElementById('detail-content').innerHTML = `
      <div class="product-detail-container">
        <!-- Product Header -->
        <div class="product-header">
          <div class="breadcrumb">
            <a onclick="showPage('home')">Home</a> / 
            <a onclick="showPage('shop')">Shop</a> / 
            <span>${p.name}</span>
          </div>
        </div>
        
        <!-- Main Product Grid -->
        <div class="product-main-grid">
          <!-- Product Images -->
          <div class="product-gallery">
            <div class="main-product-image">
              ${p.image_url && !p.image_url.includes('Minimalist_Digital_Banner') ? 
                `<img src="${p.image_url}" alt="${p.name}" class="detail-product-img" onclick="openImageZoom('${p.image_url}')" onload="this.classList.add('loaded')" onerror="this.classList.add('error'); this.style.display='none'; this.parentElement.innerHTML='<div class=&quot;product-placeholder&quot; style=&quot;background:${getBg('${p.type}')}&quot;>' + getPotHtml('${p.type}', '#C4622D', 300) + '</div>'">
                <div class="zoom-overlay" onclick="openImageZoom('${p.image_url}')">
                  <span>🔍 Click to zoom</span>
                </div>` : 
                `<div class="product-placeholder" style="background:${getBg(p.type)}">${getPotHtml(p.type, '#C4622D', 300)}</div>`
              }
            </div>
            <div class="product-thumbnails">
              ${p.image_url && !p.image_url.includes('Minimalist_Digital_Banner') ? 
                `<div class="thumbnail active" onclick="changeMainImage('${p.image_url}')">
                  <img src="${p.image_url}" alt="${p.name}">
                </div>` : ''
              }
              <div class="thumbnail" onclick="changeMainImage('')">
                <div class="thumbnail-placeholder" style="background:${getBg(p.type)}">${getPotHtml(p.type, '#C4622D', 60)}</div>
              </div>
            </div>
          </div>
          
          <!-- Product Information -->
          <div class="product-info">
            <div class="product-category">${catLabels[p.category] || p.category}</div>
            <h1 class="product-name">${p.name}</h1>
            
            <div class="product-rating">
              <div class="stars">
                ${generateStars(p.avg_rating || p.stars || 5)}
                <span class="rating-text">(${p.review_count || 0} reviews)</span>
              </div>
              <a href="#reviews" class="reviews-link" onclick="scrollToReviews()">Write a review</a>
            </div>
            
            <div class="product-price">
              <span class="price">₹${Number(p.price).toLocaleString('en-IN')}</span>
              <span class="tax-info">Inclusive of all taxes</span>
            </div>
            
            <div class="product-description">
              <h3>Description</h3>
              <p>${p.desc || 'A beautiful handcrafted pottery piece from Kuyavan Pottery Studio. Each piece is carefully crafted by skilled artisans using traditional techniques passed down through generations.'}</p>
            </div>
            
            <div class="product-details">
              <div class="detail-row">
                <span class="detail-label">Artisan:</span>
                <span class="detail-value">${p.artisan || 'Master Artisan'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Material:</span>
                <span class="detail-value">${p.material || 'Premium Terracotta'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Size:</span>
                <span class="detail-value">${p.size || 'Standard Size'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Care:</span>
                <span class="detail-value">${p.care || 'Handle with care, hand wash recommended'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Availability:</span>
                <span class="detail-value stock-status ${p.stock <= 3 ? 'low-stock' : 'in-stock'}">
                  ${p.stock <= 3 ? `Only ${p.stock} left` : 'In Stock'}
                </span>
              </div>
            </div>
            
            <div class="purchase-actions">
              <button class="btn-add-cart" onclick="addToCart(${p.id}, '${p.name}'); openCart()">
                <span class="btn-icon">🛒</span>
                Add to Cart
              </button>
              <button class="btn-buy-now" onclick="buyNow(${p.id})">
                <span class="btn-icon">⚡</span>
                Buy Now
              </button>
            </div>
            
            <div class="product-features">
              <div class="feature">
                <span class="feature-icon">✓</span>
                <span>Handmade with love</span>
              </div>
              <div class="feature">
                <span class="feature-icon">✓</span>
                <span>Premium terracotta clay</span>
              </div>
              <div class="feature">
                <span class="feature-icon">✓</span>
                <span>Traditional craftsmanship</span>
              </div>
              <div class="feature">
                <span class="feature-icon">✓</span>
                <span>Eco-friendly packaging</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Reviews Section -->
        <div class="reviews-section" id="reviews">
          <div class="reviews-header">
            <h2>Customer Reviews</h2>
            <div class="reviews-summary">
              <div class="overall-rating">
                <div class="rating-number">${p.avg_rating || p.stars || 5}</div>
                <div class="rating-stars">${generateStars(p.avg_rating || p.stars || 5)}</div>
                <div class="total-reviews">${p.review_count || 0} reviews</div>
              </div>
              <div class="rating-distribution">
                ${ratingBreakdown.map(rb => `
                  <div class="rating-bar">
                    <span class="rating-stars-label">${rb.rating}★</span>
                    <div class="progress-bar">
                      <div class="progress-fill" style="width: ${rb.percentage}%"></div>
                    </div>
                    <span class="rating-count">${rb.count}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          
          <div class="write-review">
            ${currentUser ? 
              `<button class="btn-write-review" onclick="openReviewModal(${p.id})">Write a Review</button>` :
              `<p>Please <a onclick="openAuthModal()">login</a> to write a review</p>`
            }
          </div>
          
          <div class="reviews-list">
            ${reviews.length > 0 ? reviews.map(review => `
              <div class="review-card">
                <div class="review-header">
                  <div class="reviewer-info">
                    <div class="reviewer-name">${review.user_name}</div>
                    <div class="review-date">${review.created_at}</div>
                    ${review.verified_purchase ? '<span class="verified-badge">✓ Verified Purchase</span>' : ''}
                  </div>
                  <div class="review-rating">${generateStars(review.rating)}</div>
                </div>
                ${review.title ? `<h4 class="review-title">${review.title}</h4>` : ''}
                <p class="review-content">${review.content}</p>
                <div class="review-actions">
                  <button class="btn-helpful" onclick="markHelpful(${review.id})">
                    👍 Helpful (${review.helpful_count})
                  </button>
                  <button class="btn-report">Report</button>
                </div>
              </div>
            `).join('') : '<div class="no-reviews">No reviews yet. Be the first to review this product!</div>'}
          </div>
        </div>
      </div>
    `;
    
    console.log('Rendering product detail page...');
    showPage('detail', { pushState: false });
    console.log('Product detail page shown');
    if(pushState) updateHistory('/products/'+id, { page: 'detail', productId: id });
  } catch(e){ 
    console.error('Error in viewProduct:', e);
    showToast('Could not load product.', 'error'); 
  }
}

// Helper function to generate star rating HTML
function generateStars(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  let stars = '';
  
  for(let i = 1; i <= 5; i++) {
    if(i <= fullStars) {
      stars += '<span class="star filled">★</span>';
    } else if(i === fullStars + 1 && hasHalfStar) {
      stars += '<span class="star half">★</span>';
    } else {
      stars += '<span class="star empty">★</span>';
    }
  }
  
  return stars;
}

function changeMainImage(imageUrl) {
  const mainImageContainer = document.querySelector('.main-product-image');
  const productType = document.querySelector('.product-placeholder') ? 
    document.querySelector('.product-placeholder').style.background.match(/getBg\(([^)]+)\)/)?.[1] : 'large';
  
  if(imageUrl && !imageUrl.includes('Minimalist_Digital_Banner')) {
    mainImageContainer.innerHTML = `
      <img src="${imageUrl}" alt="Product image" class="detail-product-img" onclick="openImageZoom('${imageUrl}')" onload="this.classList.add('loaded')" onerror="this.classList.add('error'); this.style.display='none'; this.parentElement.innerHTML='<div class=&quot;product-placeholder&quot; style=&quot;background:${getBg(productType)}&quot;>' + getPotHtml('${productType}', '#C4622D', 300) + '</div>'">
      <div class="zoom-overlay" onclick="openImageZoom('${imageUrl}')">
        <span>🔍 Click to zoom</span>
      </div>
    `;
  } else {
    mainImageContainer.innerHTML = `
      <div class="product-placeholder" style="background:${getBg(productType)}">${getPotHtml(productType, '#C4622D', 300)}</div>
    `;
  }
  
  // Update thumbnail active state
  document.querySelectorAll('.thumbnail').forEach(thumb => thumb.classList.remove('active'));
  if(event && event.target) {
    event.target.closest('.thumbnail').classList.add('active');
  }
}

function openImageZoom(imageUrl) {
  if(!imageUrl) return;
  
  // Create modal for zoomed image
  const modal = document.createElement('div');
  modal.className = 'image-zoom-modal';
  modal.innerHTML = `
    <div class="zoom-modal-content">
      <button class="zoom-close" onclick="closeImageZoom()">×</button>
      <img src="${imageUrl}" alt="Product zoom view" class="zoom-image">
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.style.display = 'flex';
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if(e.target === modal) closeImageZoom();
  });
  
  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') closeImageZoom();
  });
}

function closeImageZoom() {
  const modal = document.querySelector('.image-zoom-modal');
  if(modal) {
    document.body.removeChild(modal);
  }
}

function scrollToReviews() {
  const reviewsSection = document.getElementById('reviews');
  if(reviewsSection) {
    reviewsSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function buyNow(productId) {
  // Add to cart and go to checkout
  addToCart(productId, '').then(() => {
    showPage('checkout');
  });
}

// Review Modal Functions
function openReviewModal(productId) {
  const modal = document.createElement('div');
  modal.className = 'review-modal';
  modal.innerHTML = `
    <div class="review-modal-content">
      <div class="review-modal-header">
        <h3>Write a Review</h3>
        <button class="close-btn" onclick="closeReviewModal()">×</button>
      </div>
      <div class="review-form">
        <div class="form-group">
          <label>Rating *</label>
          <div class="star-rating-input">
            ${[1,2,3,4,5].map(star => `
              <button type="button" class="star-btn" data-rating="${star}" onclick="setReviewRating(${star})">★</button>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>Title (Optional)</label>
          <input type="text" id="review-title" placeholder="Summarize your review">
        </div>
        <div class="form-group">
          <label>Review *</label>
          <textarea id="review-content" rows="5" placeholder="Share your experience with this product..."></textarea>
        </div>
        <div class="review-actions">
          <button class="submit-review-btn" onclick="submitReview(${productId})">Submit Review</button>
          <button class="cancel-btn" onclick="closeReviewModal()">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.style.display = 'flex';
  currentReviewRating = 0;
}

function closeReviewModal() {
  const modal = document.querySelector('.review-modal');
  if (modal) {
    document.body.removeChild(modal);
  }
  currentReviewRating = 0;
}

function setReviewRating(rating) {
  currentReviewRating = rating;
  document.querySelectorAll('.star-btn').forEach((btn, index) => {
    btn.classList.toggle('active', index < rating);
  });
}

async function submitReview(productId) {
  if (!currentReviewRating) {
    showToast('Please select a rating', 'error');
    return;
  }
  
  const title = document.getElementById('review-title').value.trim();
  const content = document.getElementById('review-content').value.trim();
  
  if (!content) {
    showToast('Please write a review', 'error');
    return;
  }
  
  try {
    const review = await api('/api/products/' + productId + '/reviews', {
      method: 'POST',
      body: JSON.stringify({
        rating: currentReviewRating,
        title: title,
        content: content
      })
    });
    
    showToast('Review submitted successfully!', 'success');
    closeReviewModal();
    // Refresh the product page to show the new review
    viewProduct(productId, { pushState: false });
  } catch(e) {
    showToast(e.message || 'Failed to submit review', 'error');
  }
}

async function markHelpful(reviewId) {
  try {
    const result = await api('/api/reviews/' + reviewId + '/helpful', {
      method: 'POST'
    });
    
    // Update the helpful count in the UI
    const helpfulBtn = document.querySelector(`[onclick="markHelpful(${reviewId})"]`);
    if (helpfulBtn) {
      helpfulBtn.innerHTML = `👍 Helpful (${result.helpful_count})`;
      helpfulBtn.disabled = true;
      helpfulBtn.style.opacity = '0.6';
    }
    
    showToast('Marked as helpful', 'success');
  } catch(e) {
    showToast(e.message || 'Failed to mark as helpful', 'error');
  }
}

// ─── CART ─────────────────────────────────────────────────────────
async function loadCartCount() {
  try { const r=await api('/api/cart/count'); document.getElementById('cart-count').textContent=r.count||0; } catch(e){}
}

async function addToCart(id, name) {
  try {
    const r = await api('/api/cart', {method:'POST', body:JSON.stringify({id,qty:1})});
    document.getElementById('cart-count').textContent = r.cart_count||0;
    showToast((name||'Item')+' added to cart!', 'success');
    if(document.getElementById('cart-sidebar').classList.contains('open')) loadCartItems();
  } catch(e){ showToast(e.message||'Could not add to cart.', 'error'); }
}

async function loadCartItems() {
  const container = document.getElementById('cart-items-container');
  const totalEl = document.getElementById('cart-total-val');
  try {
    cartItems = await api('/api/cart');
    if(!cartItems.length) {
      container.innerHTML = `<div class="cart-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><p>Your cart is empty.</p></div>`;
      totalEl.textContent = '₹0'; return;
    }
    let total = 0;
    container.innerHTML = cartItems.map(item => {
      total += item.price*item.qty;
      return `<div class="cart-item">
        <div class="cart-item-img">${getPotHtml(item.type,'#C4622D',36)}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">₹${(item.price*item.qty).toLocaleString('en-IN')}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="updateCartQty(${item.id},${item.qty-1})">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" onclick="updateCartQty(${item.id},${item.qty+1})">+</button>
            <button class="remove-item" onclick="removeFromCart(${item.id})">Remove</button>
          </div>
        </div>
      </div>`;
    }).join('');
    totalEl.textContent = '₹'+total.toLocaleString('en-IN');
  } catch(e){ container.innerHTML='<p style="padding:1rem;color:var(--muted);">Could not load cart.</p>'; }
}

async function updateCartQty(id, qty) {
  try {
    if(qty<=0) { await removeFromCart(id); return; }
    const r = await api('/api/cart/'+id, {method:'PUT', body:JSON.stringify({qty})});
    document.getElementById('cart-count').textContent = r.cart_count||0;
    loadCartItems();
  } catch(e){}
}

async function removeFromCart(id) {
  try {
    const r = await api('/api/cart/'+id, {method:'DELETE'});
    document.getElementById('cart-count').textContent = r.cart_count||0;
    loadCartItems();
  } catch(e){}
}

function openCart() {
  document.getElementById('cart-overlay').classList.add('open');
  document.getElementById('cart-sidebar').classList.add('open');
  loadCartItems();
}
function closeCart() {
  document.getElementById('cart-overlay').classList.remove('open');
  document.getElementById('cart-sidebar').classList.remove('open');
}
function goToCheckout() {
  if(!cartItems.length){ showToast('Your cart is empty!'); return; }
  closeCart(); showPage('checkout');
}

// ─── CHECKOUT ─────────────────────────────────────────────────────
async function renderCheckoutSummary() {
  const itemsDiv = document.getElementById('checkout-items');
  const totalDiv = document.getElementById('checkout-total');
  try {
    cartItems = await api('/api/cart');
    let total = 0, html = '';
    cartItems.forEach(i => {
      const itemPrice = Number(i.price) || 0;
      const itemQty = Number(i.qty) || 0;
      const subtotal = itemPrice * itemQty;
      total += subtotal;
      html += `<div class="summary-item"><span>${i.name} × ${i.qty}</span><span>₹${subtotal.toLocaleString('en-IN')}</span></div>`;
    });
    itemsDiv.innerHTML = html || '<p style="color:var(--muted);text-align:center;padding:1rem;">Your cart is empty.</p>';
    totalDiv.textContent = '₹' + total.toLocaleString('en-IN');
    console.log('Checkout summary rendered. Total:', total, 'Items:', cartItems.length);
  } catch(e) {
    console.error('Error rendering checkout summary:', e);
    itemsDiv.innerHTML = `<p class="api-error">Could not load cart items: ${e.message}</p>`;
  }
  if(currentUser) {
    document.getElementById('co-email').value = currentUser.email||'';
    const names = (currentUser.name||'').split(' ');
    document.getElementById('co-fname').value = names[0]||'';
    document.getElementById('co-lname').value = names.slice(1).join(' ')||'';
  }
}

function selectPayment(el, method) {
  document.querySelectorAll('.payment-method').forEach(m=>m.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('co-payment').value = method;
}

async function placeOrder() {
  const btn = document.getElementById('place-order-btn');
  const errDiv = document.getElementById('checkout-error');
  errDiv.innerHTML='';
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Placing order...';
  const data = {
    first_name: document.getElementById('co-fname').value.trim(),
    last_name: document.getElementById('co-lname').value.trim(),
    email: document.getElementById('co-email').value.trim(),
    phone: document.getElementById('co-phone').value.trim(),
    address: document.getElementById('co-address').value.trim(),
    city: document.getElementById('co-city').value.trim(),
    state: document.getElementById('co-state').value,
    pincode: document.getElementById('co-pincode').value.trim(),
    payment_method: document.getElementById('co-payment').value
  };
  try {
    const r = await api('/api/orders', {method:'POST', body:JSON.stringify(data)});
    document.getElementById('success-order-id').textContent = 'Order #'+r.order_code;
    document.getElementById('cart-count').textContent = '0';
    cartItems=[];
    showPage('success');
  } catch(e) {
    errDiv.innerHTML = `<div class="api-error">${e.message}</div>`;
    btn.disabled=false; btn.textContent='Place Order →';
  }
}

// ─── AUTH ─────────────────────────────────────────────────────────
function openAuthModal(){document.getElementById('auth-modal').classList.add('open');}
function closeAuthModal(){document.getElementById('auth-modal').classList.remove('open');}
function switchAuthTab(tab) {
  document.getElementById('login-form').style.display=tab==='login'?'block':'none';
  document.getElementById('register-form').style.display=tab==='register'?'block':'none';
  document.getElementById('tab-login').classList.toggle('active',tab==='login');
  document.getElementById('tab-register').classList.toggle('active',tab==='register');
  document.getElementById('auth-error').style.display='none';
}

async function submitAuth() {
  const email=document.getElementById('auth-email').value.trim();
  const password=document.getElementById('auth-password').value;
  const errDiv=document.getElementById('auth-error');
  errDiv.style.display='none';
  try {
    const r = await api('/api/auth/login', {method:'POST', body:JSON.stringify({email,password})});
    if(r.token) localStorage.setItem('admin_token', r.token);
    setUser(r.user); closeAuthModal(); showToast('Welcome back, '+r.user.name+'!', 'success');
  } catch(e){ errDiv.textContent=e.message; errDiv.style.display='block'; }
}

async function submitRegister() {
  const name=document.getElementById('auth-name').value.trim();
  const email=document.getElementById('auth-reg-email').value.trim();
  const password=document.getElementById('auth-reg-password').value;
  const errDiv=document.getElementById('auth-error');
  errDiv.style.display='none';
  if(!name||!email||!password){ errDiv.textContent='All fields are required.'; errDiv.style.display='block'; return; }
  try {
    const r = await api('/api/auth/register', {method:'POST', body:JSON.stringify({name,email,password})});
    setUser(r.user); closeAuthModal(); showToast('Account created! Welcome, '+r.user.name+'!', 'success');
  } catch(e){ errDiv.textContent=e.message; errDiv.style.display='block'; }
}

async function logoutUser() {
  try { await api('/api/auth/logout', {method:'POST'}); } catch(e){}
  localStorage.removeItem('admin_token');
  setUser(null); showToast('Logged out successfully.', 'success');
}

// ─── ADMIN AUTH ───────────────────────────────────────────────────
async function adminLogin() {
  const email=document.getElementById('admin-email').value.trim();
  const pass=document.getElementById('admin-pass').value;
  const errDiv=document.getElementById('admin-login-error');
  errDiv.innerHTML='';
  try {
    const r = await api('/api/auth/login', {method:'POST', body:JSON.stringify({email,password:pass})});
    if(!r.user.is_admin){ errDiv.innerHTML='<div class="api-error">Not an admin account.</div>'; return; }
    if(r.token) localStorage.setItem('admin_token', r.token);
    setUser(r.user); showPage('admin');
  } catch(e){ errDiv.innerHTML=`<div class="api-error">${e.message}</div>`; }
}

async function adminLogout() {
  try { await api('/api/auth/logout', {method:'POST'}); } catch(e){}
  localStorage.removeItem('admin_token');
  setUser(null); showPage('home');
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────
async function loadAdminDashboard() {
  document.getElementById('dash-updated').textContent='Updated just now';
  try {
    const s = await api('/api/admin/stats');
    document.getElementById('stat-revenue').textContent='₹'+Number(s.total_revenue).toLocaleString('en-IN');
    document.getElementById('stat-orders').textContent=s.total_orders;
    document.getElementById('stat-products').textContent=s.total_products;
    document.getElementById('stat-customers').textContent=s.total_customers;
    const tbody=document.getElementById('dash-orders-tbody');
    tbody.innerHTML=s.recent_orders.length?s.recent_orders.map(o=>`<tr><td><strong>#${o.order_code}</strong></td><td>${o.customer_name}</td><td style="font-size:.82rem;">${o.items.map(i=>i.product_name+' ×'+i.quantity).join(', ')}</td><td>₹${Number(o.total).toLocaleString('en-IN')}</td><td><span class="status-badge status-${o.order_status}">${o.order_status}</span></td></tr>`).join(''):'<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem;">No orders yet.</td></tr>';
    if(s.low_stock.length){
      document.getElementById('low-stock-alert').style.display='block';
      document.getElementById('low-stock-names').textContent=s.low_stock.map(p=>p.name+' ('+p.stock+' left)').join(', ');
    }
  } catch(e){}
}

function showAdminSection(section) {
  ['dashboard','products','orders'].forEach(s=>{
    document.getElementById('admin-'+s).style.display='none';
    document.getElementById('nav-'+s).classList.remove('active');
  });
  document.getElementById('admin-'+section).style.display='block';
  document.getElementById('nav-'+section).classList.add('active');
  if(section==='products') loadAdminProducts();
  if(section==='orders') loadAdminOrders();
}

async function loadAdminProducts() {
  const container=document.getElementById('admin-product-cards');
  container.innerHTML='<div style="text-align:center;padding:2rem;color:var(--muted);">Loading...</div>';
  try {
    const prods = await api('/api/products?show_hidden=1');
    container.innerHTML=prods.length?prods.map(p=>`
      <div class="admin-product-card${p.visible===false?' hidden-product':''}">
        <div class="apc-img" style="background:${getBg(p.type)}">${getProductMedia(p,38)}</div>
        <div class="apc-body">
          <div class="apc-name">${p.name}</div>
          <div class="apc-meta">by ${p.artisan||'Artisan'}</div>
          <div class="apc-price">₹${Number(p.price).toLocaleString('en-IN')}</div>
          <div class="apc-tags">
            <span class="apc-tag cat">${p.category}</span>
            ${p.stock<=3?`<span class="apc-tag low">Only ${p.stock} left</span>`:`<span class="apc-tag cat">Stock: ${p.stock}</span>`}
            ${p.visible===false?'<span class="apc-tag hidden-tag">Hidden</span>':''}
          </div>
        </div>
        <div class="apc-actions">
          <button class="btn-sm btn-edit" onclick="openProductModal(${p.id})">✏️ Edit</button>
          <button class="btn-sm" onclick="quickToggle(${p.id},${!p.visible})" style="background:${p.visible===false?'#E8F5E9':'#FFF3E0'};color:${p.visible===false?'#2E7D32':'#E65100'};">${p.visible===false?'👁 Show':'🚫 Hide'}</button>
          <button class="btn-sm btn-delete" onclick="openDelModal(${p.id},'${p.name.replace(/'/g,"\\'")}')">🗑 Delete</button>
        </div>
      </div>`).join(''):'<p style="text-align:center;color:var(--muted);padding:2rem;">No products yet. Add one!</p>';
  } catch(e){ container.innerHTML=`<p style="color:var(--muted);padding:2rem;">Could not load products: ${e.message}</p>`; }
}

async function quickToggle(id, visible) {
  try {
    await api('/api/products/'+id, {method:'PUT', body:JSON.stringify({visible})});
    showToast(visible?'Product is now visible':'Product hidden from shop', visible?'success':'');
    loadAdminProducts();
  } catch(e){ showToast(e.message,'error'); }
}

async function loadAdminOrders() {
  const tbody=document.getElementById('admin-orders-tbody');
  tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:2rem;">Loading...</td></tr>';
  const status=document.getElementById('order-filter')?.value||'';
  try {
    const orders=await api('/api/admin/orders'+(status?'?status='+status:''));
    tbody.innerHTML=orders.length?orders.map(o=>`<tr>
      <td><strong>#${o.order_code}</strong></td>
      <td>${o.customer_name}<br><small style="color:var(--muted);">${o.customer_email}</small></td>
      <td style="font-size:.82rem;max-width:180px;">${o.items.map(i=>i.product_name+' ×'+i.quantity).join(', ')}</td>
      <td>₹${Number(o.total).toLocaleString('en-IN')}</td>
      <td><span class="status-badge status-${o.payment_status}">${o.payment_method==='cod'?'COD':o.payment_status}</span></td>
      <td>
        <select onchange="updateOrderStatus(${o.id},this.value)" style="padding:.3rem .5rem;border:1px solid var(--sand-deep);border-radius:var(--radius);font-family:'Karla',sans-serif;font-size:.8rem;">
          <option value="processing" ${o.order_status==='processing'?'selected':''}>Processing</option>
          <option value="shipped" ${o.order_status==='shipped'?'selected':''}>Shipped</option>
          <option value="delivered" ${o.order_status==='delivered'?'selected':''}>Delivered</option>
          <option value="cancelled" ${o.order_status==='cancelled'?'selected':''}>Cancelled</option>
        </select>
      </td>
      <td style="font-size:.8rem;color:var(--muted);">${o.created_at}</td>
      <td><span class="status-badge status-${o.order_status}">${o.order_status}</span></td>
    </tr>`).join(''):'<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:2rem;">No orders found.</td></tr>';
  } catch(e){ tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:2rem;">${e.message}</td></tr>`; }
}

async function updateOrderStatus(id, status) {
  try {
    await api('/api/admin/orders/'+id, {method:'PUT', body:JSON.stringify({order_status:status})});
    showToast('Order updated to: '+status, 'success');
  } catch(e){ showToast(e.message,'error'); }
}

// ─── PRODUCT MODAL ────────────────────────────────────────────────
async function openProductModal(id) {
  const modal=document.getElementById('prod-modal');
  modal.classList.add('open');
  modal.style.display='flex';
  modalProdStars=5;
  document.getElementById('prod-modal-error').style.display='none';
  document.getElementById('m-image').value='';
  document.getElementById('m-image-name').textContent='No image selected';
  document.getElementById('m-prev-img').dataset.imageUrl='';
  if(id===null) {
    document.getElementById('prod-modal-title').textContent='Add New Product';
    document.getElementById('m-id').value='';
    ['m-name','m-price','m-artisan','m-material','m-size','m-care','m-desc'].forEach(f=>document.getElementById(f).value='');
    document.getElementById('m-stock').value='';
    document.getElementById('m-category').value='pots';
    document.getElementById('m-visible').checked=true;
  } else {
    document.getElementById('prod-modal-title').textContent='Edit Product';
    try {
      const p=await api('/api/products/'+id);
      document.getElementById('m-id').value=p.id;
      document.getElementById('m-name').value=p.name||'';
      document.getElementById('m-price').value=p.price||'';
      document.getElementById('m-category').value=p.category||'pots';
      document.getElementById('m-stock').value=p.stock||'';
      document.getElementById('m-artisan').value=p.artisan||'';
      document.getElementById('m-material').value=p.material||'';
      document.getElementById('m-size').value=p.size||'';
      document.getElementById('m-care').value=p.care||'';
      document.getElementById('m-desc').value=p.desc||'';
      document.getElementById('m-visible').checked=p.visible!==false;
      document.getElementById('m-prev-img').dataset.imageUrl=p.image_url||'';
      document.getElementById('m-image-name').textContent=p.image_url?'Current image saved':'No image selected';
      modalProdStars=p.stars||5;
    } catch(e){ showToast('Could not load product.','error'); closeProdModal(); return; }
  }
  setProdStars(modalProdStars);
  syncToggle();
  updateProdPreview();
}

function closeProdModal(){document.getElementById('prod-modal').classList.remove('open');document.getElementById('prod-modal').style.display='none';}

function setProdStars(n){
  modalProdStars=n;
  document.getElementById('m-stars').value=n;
  const labels=['','Poor','Fair','Good','Great','Excellent'];
  document.getElementById('m-stars-label').textContent=labels[n]||'';
  for(let i=1;i<=5;i++){
    const el=document.getElementById('ms-'+i);
    el.style.color=i<=n?'var(--clay-light)':'var(--sand-deep)';
    el.style.transform=i===n?'scale(1.2)':'scale(1)';
  }
  updateProdPreview();
}

function syncToggle(){
  const checked=document.getElementById('m-visible').checked;
  document.getElementById('m-toggle-track').style.background=checked?'var(--success)':'var(--sand-deep)';
  document.getElementById('m-toggle-thumb').style.left=checked?'25px':'3px';
}

function handleProductImageChange(event){
  const file=event.target.files?.[0];
  const nameEl=document.getElementById('m-image-name');
  const preview=document.getElementById('m-prev-img');
  if(!file){
    nameEl.textContent='No image selected';
    updateProdPreview();
    return;
  }
  nameEl.textContent=file.name;
  const reader=new FileReader();
  reader.onload=()=>{
    preview.innerHTML=`<img src="${reader.result}" alt="Product preview" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius);display:block;">`;
    preview.style.background='var(--sand-deep)';
  };
  reader.readAsDataURL(file);
}

function updateProdPreview(){
  const name=document.getElementById('m-name').value||'Product Name';
  const price=parseInt(document.getElementById('m-price').value)||0;
  const cat=document.getElementById('m-category').value||'pots';
  const stock=parseInt(document.getElementById('m-stock').value)||0;
  const typeMap={pots:'large',toys:'toy',decor:'decor'};
  const type=typeMap[cat]||'large';
  const catLabels={pots:'Clay Pots',toys:'Clay Toys',decor:'Terracotta Decor'};
  const imageUrl=document.getElementById('m-prev-img').dataset.imageUrl||'';
  const hasUpload=document.getElementById('m-image').files?.length>0;
  document.getElementById('m-prev-name').textContent=name;
  document.getElementById('m-prev-cat').textContent=catLabels[cat]||cat;
  document.getElementById('m-prev-price').textContent=price?'Rs '+price.toLocaleString('en-IN'):'--';
  if(!hasUpload){
    if(imageUrl){
      document.getElementById('m-prev-img').innerHTML=`<img src="${imageUrl}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius);display:block;">`;
      document.getElementById('m-prev-img').style.background='var(--sand-deep)';
    } else {
      document.getElementById('m-prev-img').innerHTML=getPotHtml(type,'#C4622D',38);
      document.getElementById('m-prev-img').style.background=getBg(type);
    }
  }
  document.getElementById('m-prev-stock').textContent=stock>0?(stock<=3?'Only '+stock+' left':stock+' in stock'):'Out of stock';
  document.getElementById('m-prev-stock').style.color=stock<=3?'#E65100':'var(--success)';
  document.getElementById('m-prev-stars').textContent='*'.repeat(modalProdStars)+'.'.repeat(5-modalProdStars);
}

async function saveProduct(){
  const btn=document.getElementById('prod-save-btn');
  const errDiv=document.getElementById('prod-modal-error');
  errDiv.style.display='none';
  const name=document.getElementById('m-name').value.trim();
  const price=parseFloat(document.getElementById('m-price').value);
  const stock=parseInt(document.getElementById('m-stock').value);
  if(!name){errDiv.textContent='Product name is required.';errDiv.style.display='block';return;}
  if(!price||price<1){errDiv.textContent='Enter a valid price.';errDiv.style.display='block';return;}
  if(isNaN(stock)||stock<0){errDiv.textContent='Enter a valid stock number.';errDiv.style.display='block';return;}
  const data=new FormData();
  data.append('name', name);
  data.append('price', price);
  data.append('category', document.getElementById('m-category').value);
  data.append('stock', stock);
  data.append('artisan', document.getElementById('m-artisan').value.trim()||'Artisan');
  data.append('material', document.getElementById('m-material').value.trim()||'Terracotta');
  data.append('size', document.getElementById('m-size').value.trim());
  data.append('care', document.getElementById('m-care').value.trim());
  data.append('desc', document.getElementById('m-desc').value.trim());
  data.append('stars', modalProdStars);
  data.append('visible', document.getElementById('m-visible').checked);
  const imageFile=document.getElementById('m-image').files?.[0];
  if(imageFile) data.append('image', imageFile);
  const id=document.getElementById('m-id').value;
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Saving...';
  try {
    if(id){ await api('/api/products/'+id,{method:'PUT',body:data}); showToast(name+' updated!','success'); }
    else { await api('/api/products',{method:'POST',body:data}); showToast(name+' added!','success'); }
    closeProdModal(); loadAdminProducts();
    document.getElementById('stat-products').textContent=parseInt(document.getElementById('stat-products').textContent||'0')+(id?0:1);
  } catch(e){ errDiv.textContent=e.message; errDiv.style.display='block'; }
  finally{ btn.disabled=false; btn.textContent='Save Product'; }
}

// ─── DELETE MODAL ─────────────────────────────────────────────────
function openDelModal(id,name){
  deleteProdId=id;
  document.getElementById('del-modal-name').textContent='Delete "'+name+'"? This cannot be undone.';
  document.getElementById('del-modal').classList.add('open');
  document.getElementById('del-modal').style.display='flex';
}
function closeDelModal(){deleteProdId=null;document.getElementById('del-modal').classList.remove('open');document.getElementById('del-modal').style.display='none';}
async function confirmDelete(){
  if(!deleteProdId) return;
  try {
    const r=await api('/api/products/'+deleteProdId,{method:'DELETE'});
    showToast(r.message||'Product deleted.','success');
    closeDelModal(); loadAdminProducts();
  } catch(e){ showToast(e.message,'error'); closeDelModal(); }
}

// ─── AI CHATBOT ───────────────────────────────────────────────────
let chatOpen=false;
function toggleChat(){chatOpen=!chatOpen;document.getElementById('ai-chat-window').classList.toggle('open',chatOpen);}
async function sendChat(){
  const input=document.getElementById('chat-input');
  const msg=input.value.trim();
  if(!msg) return;
  input.value='';
  appendMsg(msg,'user');
  const typing=appendMsg('...','bot');
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:300,system:`You are a friendly assistant for Kuyavan Pottery Studio, a traditional handmade pottery shop from Tamil Nadu, India. Products: clay pots (₹450-₹1200), clay toys (₹220-₹550), terracotta decor (₹320-₹980). Artisans: Murugan Kuyavar, Selvi Rani, Lakshmi Kuyavar. Free shipping above ₹999. Delivery 5-7 days. Payment: Razorpay & COD. Reply warmly and briefly.`,messages:[{role:'user',content:msg}]})});
    const data=await res.json();
    typing.remove();
    appendMsg(data.content?.[0]?.text||'Please browse our collection!','bot');
  }catch(e){typing.remove();appendMsg('Sorry, I\'m having trouble. Email kuyavan@pottery.in for help.','bot');}
}
function appendMsg(text,cls){const msgs=document.getElementById('chat-msgs');const div=document.createElement('div');div.className='msg '+cls;div.textContent=text;msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;return div;}

// ─── TOAST ────────────────────────────────────────────────────────
function showToast(msg,type=''){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast'+(type?' '+type:'');
  t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000);
}

// ─── START ────────────────────────────────────────────────────────
init();
