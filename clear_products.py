#!/usr/bin/env python3
"""
Script to clear all existing products from the database.
This ensures that after removing default products from seed_data(),
no existing products remain in the database.
"""

import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_dir))

# Import the Flask app and database
from app import app, db, Product

def clear_all_products():
    """Remove all products from the database."""
    with app.app_context():
        # Count existing products
        product_count = Product.query.count()
        print(f"Found {product_count} products in the database.")
        
        if product_count > 0:
            # Delete all products
            Product.query.delete()
            db.session.commit()
            print(f"Successfully deleted {product_count} products.")
        else:
            print("No products to delete.")
        
        # Verify deletion
        remaining_count = Product.query.count()
        print(f"Remaining products: {remaining_count}")
        
        return remaining_count == 0

if __name__ == "__main__":
    print("Clearing all products from the database...")
    success = clear_all_products()
    if success:
        print("All products cleared successfully!")
    else:
        print("Failed to clear all products.")
        sys.exit(1)
