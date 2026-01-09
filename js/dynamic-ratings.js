// تحديث التقييمات الديناميكية في جميع صفحات المنتجات
(function() {
    'use strict';

    // بيانات تقييمات تجريبية للمنتجات
    const productRatings = {
        1: { rating: 4.8, reviews: 12 },
        2: { rating: 4.5, reviews: 8 },
        3: { rating: 4.9, reviews: 15 },
        4: { rating: 4.2, reviews: 5 },
        5: { rating: 4.7, reviews: 22 },
        6: { rating: 4.2, reviews: 9 },
        7: { rating: 4.6, reviews: 11 },
        8: { rating: 4.6, reviews: 18 },
        9: { rating: 4.1, reviews: 7 },
        10: { rating: 4.4, reviews: 13 },
        11: { rating: 3.7, reviews: 6 },
        12: { rating: 4.5, reviews: 16 },
        13: { rating: 4.0, reviews: 10 },
        14: { rating: 4.8, reviews: 20 },
        15: { rating: 4.3, reviews: 14 },
        16: { rating: 4.7, reviews: 19 },
        17: { rating: 4.1, reviews: 8 },
        18: { rating: 3.8, reviews: 12 },
        19: { rating: 4.6, reviews: 17 },
        20: { rating: 4.2, reviews: 11 },
        21: { rating: 4.9, reviews: 25 },
        22: { rating: 4.3, reviews: 9 },
        23: { rating: 4.4, reviews: 15 },
        24: { rating: 4.8, reviews: 13 },
        25: { rating: 4.7, reviews: 21 },
        26: { rating: 3.9, reviews: 7 },
        27: { rating: 4.5, reviews: 18 },
        28: { rating: 4.3, reviews: 16 },
        29: { rating: 4.1, reviews: 10 },
        30: { rating: 4.8, reviews: 23 },
        31: { rating: 4.6, reviews: 19 },
        32: { rating: 4.2, reviews: 14 },
        33: { rating: 4.4, reviews: 12 },
        34: { rating: 4.1, reviews: 8 },
        35: { rating: 4.5, reviews: 16 },
        36: { rating: 4.3, reviews: 11 },
        37: { rating: 4.0, reviews: 9 },
        38: { rating: 4.6, reviews: 17 },
        39: { rating: 4.2, reviews: 13 },
        40: { rating: 4.7, reviews: 20 },
        41: { rating: 4.4, reviews: 15 },
        42: { rating: 4.8, reviews: 22 },
        43: { rating: 4.1, reviews: 10 },
        44: { rating: 4.3, reviews: 12 },
        45: { rating: 4.5, reviews: 18 },
        46: { rating: 4.0, reviews: 8 },
        47: { rating: 4.6, reviews: 14 },
        48: { rating: 4.2, reviews: 11 },
        49: { rating: 4.4, reviews: 16 },
        50: { rating: 4.7, reviews: 19 },
        51: { rating: 4.1, reviews: 9 },
        52: { rating: 4.5, reviews: 13 },
        53: { rating: 4.3, reviews: 15 },
        54: { rating: 4.6, reviews: 17 },
        55: { rating: 4.0, reviews: 7 },
        56: { rating: 4.8, reviews: 21 },
        57: { rating: 4.2, reviews: 12 },
        58: { rating: 4.4, reviews: 14 },
        59: { rating: 4.7, reviews: 18 },
        60: { rating: 4.1, reviews: 10 },
        61: { rating: 4.5, reviews: 16 },
        62: { rating: 4.3, reviews: 13 },
        63: { rating: 4.6, reviews: 19 },
        64: { rating: 4.0, reviews: 8 },
        65: { rating: 4.8, reviews: 23 },
        66: { rating: 4.2, reviews: 11 },
        67: { rating: 4.4, reviews: 15 },
        68: { rating: 4.7, reviews: 17 },
        69: { rating: 4.1, reviews: 9 },
        70: { rating: 4.5, reviews: 20 }
    };

    // تهيئة التقييمات عند تحميل الصفحة
    document.addEventListener('DOMContentLoaded', function() {
        updateAllProductRatings();
    });

    function updateAllProductRatings() {
        // العثور على جميع المنتجات في الصفحة
        const products = document.querySelectorAll('.product[data-id]');
        
        products.forEach(product => {
            const productId = parseInt(product.dataset.id);
            const ratingData = productRatings[productId];
            
            if (ratingData) {
                updateProductRating(product, ratingData);
            }
        });
    }

    function updateProductRating(productElement, ratingData) {
        const starsContainer = productElement.querySelector('.stars');
        if (!starsContainer) return;

        // مسح النجوم الموجودة
        starsContainer.innerHTML = '';

        // إضافة النجوم الجديدة
        const rating = ratingData.rating;
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;

        // إضافة النجوم الممتلئة
        for (let i = 0; i < fullStars; i++) {
            const star = document.createElement('i');
            star.className = 'fa-solid fa-star text-warning';
            starsContainer.appendChild(star);
        }

        // إضافة نجمة نصف ممتلئة إذا لزم الأمر
        if (hasHalfStar) {
            const halfStar = document.createElement('i');
            halfStar.className = 'fa-solid fa-star-half-stroke text-warning';
            starsContainer.appendChild(halfStar);
        }

        // إضافة النجوم الفارغة
        const totalStars = 5;
        const emptyStars = totalStars - fullStars - (hasHalfStar ? 1 : 0);
        for (let i = 0; i < emptyStars; i++) {
            const star = document.createElement('i');
            star.className = 'fa-regular fa-star';
            starsContainer.appendChild(star);
        }

        // إضافة نص التقييم إذا لم يكن موجوداً
        let ratingText = starsContainer.nextElementSibling;
        if (!ratingText || !ratingText.classList.contains('rating-text')) {
            ratingText = document.createElement('small');
            ratingText.className = 'rating-text text-muted d-block mt-1';
            starsContainer.parentNode.insertBefore(ratingText, starsContainer.nextSibling);
        }
        
        ratingText.textContent = `${rating.toFixed(1)} (${ratingData.reviews} تقييم)`;
    }

    // دالة لتحديث تقييم منتج واحد (للاستخدام الخارجي)
    function updateSingleProductRating(productId, rating, reviewCount) {
        productRatings[productId] = { rating, reviews: reviewCount };
        
        const productElement = document.querySelector(`.product[data-id="${productId}"]`);
        if (productElement) {
            updateProductRating(productElement, { rating, reviews: reviewCount });
        }
    }

    // تصدير الدوال للاستخدام الخارجي
    window.DynamicRatings = {
        update: updateAllProductRatings,
        updateSingle: updateSingleProductRating,
        getRating: function(productId) {
            return productRatings[productId] || { rating: 0, reviews: 0 };
        }
    };

})();