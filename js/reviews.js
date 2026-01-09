// Reviews UI logic.
(function () {
    "use strict";

    let currentProductId = null;
    let selectedRating = 0;

    document.addEventListener("DOMContentLoaded", function () {
        initializeReviews();
        setupEventListeners();
    });

    function initializeReviews() {
        const urlParams = new URLSearchParams(window.location.search);
        currentProductId = urlParams.get("id") || getProductIdFromPage();

        if (currentProductId) {
            loadProductReviews(currentProductId);
        }
    }

    function getProductIdFromPage() {
        const productElement = document.querySelector("[data-product-id]");
        if (productElement) {
            return productElement.dataset.productId;
        }

        return "1";
    }

    function setupEventListeners() {
        const ratingStars = document.querySelectorAll("#ratingInput i");
        ratingStars.forEach((star) => {
            star.addEventListener("click", function () {
                selectedRating = parseInt(this.dataset.rating, 10);
                updateRatingDisplay(selectedRating);
            });

            star.addEventListener("mouseover", function () {
                const hoverRating = parseInt(this.dataset.rating, 10);
                updateRatingDisplay(hoverRating);
            });
        });

        const ratingInput = document.getElementById("ratingInput");
        if (ratingInput) {
            ratingInput.addEventListener("mouseleave", function () {
                updateRatingDisplay(selectedRating);
            });
        }

        const reviewForm = document.getElementById("reviewForm");
        if (reviewForm) {
            reviewForm.addEventListener("submit", handleReviewSubmit);
        }
    }

    function updateRatingDisplay(rating) {
        const stars = document.querySelectorAll("#ratingInput i");
        stars.forEach((star, index) => {
            const starRating = index + 1;
            if (starRating <= rating) {
                star.className = "fa-solid fa-star text-warning";
            } else {
                star.className = "fa-regular fa-star";
            }
        });
    }

    function loadProductReviews(productId) {
        fetch(`actions/reviews.php?product_id=${productId}`)
            .then((response) => response.json())
            .then((data) => {
                if (data.ok) {
                    displayReviews(data.reviews, data.stats);
                } else {
                    console.error("خطأ في جلب التقييمات:", data.error);
                }
            })
            .catch((error) => {
                console.error("خطأ في الاتصال:", error);
            });
    }

    function displayReviews(reviews, stats) {
        updateMainPageRating(stats);
        updateModalStats(stats);
        displayReviewsList(reviews);
    }

    function updateMainPageRating(stats) {
        const averageStars = document.getElementById("averageStars");
        const ratingText = document.getElementById("ratingText");

        if (averageStars && ratingText) {
            const rating = stats.average_rating || 0;
            const totalReviews = stats.total_reviews || 0;

            updateStarsDisplay(averageStars, rating);
            ratingText.textContent = `${rating} (${totalReviews} تقييم)`;
        }
    }

    function updateModalStats(stats) {
        const avgRatingNumber = document.getElementById("avgRatingNumber");
        const avgRatingStars = document.getElementById("avgRatingStars");
        const totalReviewsText = document.getElementById("totalReviewsText");
        const ratingBreakdown = document.getElementById("ratingBreakdown");

        if (avgRatingNumber) {
            avgRatingNumber.textContent = (stats.average_rating || 0).toFixed(1);
        }

        if (avgRatingStars) {
            updateStarsDisplay(avgRatingStars, stats.average_rating || 0);
        }

        if (totalReviewsText) {
            const total = stats.total_reviews || 0;
            totalReviewsText.textContent = `${total} تقييم`;
        }

        if (ratingBreakdown && stats.rating_breakdown) {
            displayRatingBreakdown(ratingBreakdown, stats.rating_breakdown, stats.total_reviews);
        }
    }

    function updateStarsDisplay(container, rating) {
        const stars = container.querySelectorAll("i");
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;

        stars.forEach((star, index) => {
            if (index < fullStars) {
                star.className = "fa-solid fa-star text-warning";
            } else if (index === fullStars && hasHalfStar) {
                star.className = "fa-solid fa-star-half-stroke text-warning";
            } else {
                star.className = "fa-regular fa-star";
            }
        });
    }

    function displayRatingBreakdown(container, breakdown, total) {
        container.innerHTML = "";

        for (let i = 5; i >= 1; i -= 1) {
            const count = breakdown[i] || 0;
            const percentage = total > 0 ? (count / total) * 100 : 0;

            const row = document.createElement("div");
            row.className = "d-flex align-items-center mb-2";
            row.innerHTML = `
                <span class="me-2">${i} نجمة</span>
                <div class="progress flex-grow-1 me-2" style="height: 8px;">
                    <div class="progress-bar bg-warning" style="width: ${percentage}%"></div>
                </div>
                <span class="text-muted">${count}</span>
            `;
            container.appendChild(row);
        }
    }

    function displayReviewsList(reviews) {
        const reviewsList = document.getElementById("reviewsList");
        if (!reviewsList) return;

        reviewsList.innerHTML = "";

        if (reviews.length === 0) {
            reviewsList.innerHTML =
                '<p class="text-muted text-center">لا توجد تقييمات بعد. كن أول من يقيم هذا المنتج!</p>';
            return;
        }

        reviews.forEach((review) => {
            const reviewElement = document.createElement("div");
            reviewElement.className = "review-item border-bottom pb-3 mb-3";

            const reviewDate = new Date(review.created_at).toLocaleDateString("ar-SA");

            reviewElement.innerHTML = `
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <strong>${review.user_name}</strong>
                        <div class="stars-small">
                            ${generateStarsHTML(review.rating)}
                        </div>
                    </div>
                    <small class="text-muted">${reviewDate}</small>
                </div>
                ${review.review_text ? `<p class="mb-0">${review.review_text}</p>` : ""}
            `;

            reviewsList.appendChild(reviewElement);
        });
    }

    function generateStarsHTML(rating) {
        let starsHTML = "";
        for (let i = 1; i <= 5; i += 1) {
            if (i <= rating) {
                starsHTML += '<i class="fa-solid fa-star text-warning"></i>';
            } else {
                starsHTML += '<i class="fa-regular fa-star"></i>';
            }
        }
        return starsHTML;
    }

    function handleReviewSubmit(event) {
        event.preventDefault();

        if (selectedRating === 0) {
            alert("يرجى اختيار تقييم قبل الإرسال.");
            return;
        }

        const reviewText = document.getElementById("reviewText").value.trim();

        const reviewData = {
            product_id: currentProductId,
            rating: selectedRating,
            review_text: reviewText
        };

        fetch("actions/reviews.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(reviewData)
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.ok) {
                    loadProductReviews(currentProductId);
                    document.getElementById("reviewForm").reset();
                    selectedRating = 0;
                    updateRatingDisplay(0);
                    showNotification(data.message, "success");
                } else {
                    showNotification(data.error, "error");
                }
            })
            .catch(() => {
                showNotification("حدث خطأ أثناء إرسال التقييم.", "error");
            });
    }

    function showNotification(message, type) {
        if (typeof window.__elvioraNotify === "function") {
            window.__elvioraNotify(message, type);
        } else {
            alert(message);
        }
    }

    window.ReviewsSystem = {
        loadReviews: loadProductReviews,
        setProductId: function (id) {
            currentProductId = id;
            if (id) {
                loadProductReviews(id);
            }
        }
    };
})();
