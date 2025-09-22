// Variables globales
let currentCategoryId = null;
let currentCategoryName = null;
let originCountriesMap = new Map(); // Pour stocker les pays d'origine (unique_id -> name)

// Préfixe https: si l'URL commence par //
function normalizeImageUrl(url) {
    if (!url || url.trim() === '') {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjE0MCIgdmlld0JveD0iMCAwIDI4MCAxNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyODAiIGhlaWdodD0iMTQwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0xNDAgMzJMMTUyIDQwSDE4NlY0OEgxNTJMMTk2IDg3SDg0TDE0MCA0OFoiIGZpbGw9IiNDOUM5QzkiLz4KPHR5cGUgZmlsbD0iIzRBOTBFMiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiB4PSIxNDAiIHk9Ijc1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD4KPC9zdmc+';
    }
    url = String(url).trim();
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url;
}


// Format number to show decimals only when necessary
function formatWeightValue(value) {
    if (value === null || value === undefined || value === '') return '';
    const num = parseFloat(value);
    if (isNaN(num)) return '';

    // If it's a whole number, show no decimals
    if (num === Math.floor(num)) {
        return num.toString();
    }

    // Otherwise show up to 3 decimal places, removing trailing zeros
    const fixed = num.toFixed(3);
    return fixed.replace(/\.?0+$/, '');
}

// --- Panier simple stocké en localStorage ---
function getCart() {
    try {
        return JSON.parse(localStorage.getItem('cart') || '[]');
    } catch (e) {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
}

function addToCart(item) {
    const cart = getCart();
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
        existing.qty += item.qty || 1;
    } else {
        cart.push({ id: item.id, name: item.name, price: item.price || 0, qty: item.qty || 1 });
    }
    saveCart(cart);
    console.log('Produit ajouté au panier:', item);
}

function updateCartCount() {
    const el = document.getElementById('cart-count');
    const cartButton = document.getElementById('cart-button');
    if (!el || !cartButton) return;

    const cart = getCart();
    const totalItems = cart.reduce((s, it) => s + (it.qty || 0), 0);
    const totalPrice = cart.reduce((s, it) => s + ((it.price || 0) * (it.qty || 0)), 0);

    el.textContent = totalItems;

    // Met à jour le total affiché sous l'icône
    cartButton.setAttribute('data-total', totalItems > 0 ? formatPrice(totalPrice) : '');
}

async function updateCartDisplay() {
    // Update cart count in header
    updateCartCount();

    // Update quantity displays in existing tiles
    updateQuantityDisplays();

    // Update cart modal if open
    const cartModal = document.getElementById('cart-modal');
    if (cartModal && !cartModal.classList.contains('hidden')) {
        renderCartModal();
    }

    // Update cart sidebar if open
    const cartSidebar = document.getElementById('cart-sidebar');
    if (cartSidebar && !cartSidebar.classList.contains('hidden')) {
        renderCartSidebar();
    }

    // Re-render products if we're in a category or search view to update quantities
    if (currentCategoryId) {
        // We're in category view, re-render products
        try {
            const products = await supabaseAPI.getProductsByCategory(currentCategoryId);
            displayCategoryProducts(products);
        } catch (err) {
            console.error('Erreur lors du re-render des produits de catégorie:', err);
        }
    } else if (window.currentSearchQuery) {
        // We're in search view, re-render products
        try {
            const products = await supabaseAPI.searchProducts(window.currentSearchQuery);
            displaySearchProducts(products);
        } catch (err) {
            console.error('Erreur lors du re-render des produits de recherche:', err);
        }
    }

    // Force a small delay to ensure DOM is updated
    setTimeout(() => {
        updateQuantityDisplays();
    }, 50);
}

function updateQuantityDisplays() {
    const cart = getCart();
    const cartMap = new Map(cart.map(item => [item.id, item.qty]));

    // Update all product tiles
    const productTiles = document.querySelectorAll('.product-tile');
    productTiles.forEach(tile => {
        const cartButton = tile.querySelector('.add-to-cart');
        const quantityControls = tile.querySelector('.quantity-controls');
        const productId = cartButton?.getAttribute('data-id') || tile.querySelector('.quantity-btn')?.getAttribute('data-id');

        if (productId) {
            const quantity = cartMap.get(productId) || 0;

            if (quantity > 0) {
                // Replace cart button with quantity controls
                if (cartButton) {
                    const actionsDiv = cartButton.parentElement;
                    actionsDiv.innerHTML = `
                        <div class="quantity-controls">
                            <button class="quantity-btn quantity-decrease" data-id="${productId}" aria-label="Diminuer quantité">-</button>
                            <span class="quantity-display">${quantity}</span>
                            <button class="quantity-btn quantity-increase" data-id="${productId}" aria-label="Augmenter quantité">+</button>
                        </div>
                    `;

                    // Add event listeners to new controls
                    const increaseBtn = actionsDiv.querySelector('.quantity-increase');
                    const decreaseBtn = actionsDiv.querySelector('.quantity-decrease');

                    if (increaseBtn) {
                        increaseBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            changeItemQty(productId, 1);
                            updateCartDisplay();
                        });
                    }

                    if (decreaseBtn) {
                        decreaseBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            changeItemQty(productId, -1);
                            updateCartDisplay();
                        });
                    }
                }
            } else {
                // Replace quantity controls with cart button
                if (quantityControls) {
                    const actionsDiv = quantityControls.parentElement;
                    actionsDiv.innerHTML = `
                        <button class="add-to-cart" data-id="${productId}" aria-label="Ajouter au panier" title="Ajouter au panier">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6 6H21L20 12H8L6 6Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="10" cy="19" r="1" fill="currentColor"/>
                                <circle cx="18" cy="19" r="1" fill="currentColor"/>
                            </svg>
                        </button>
                    `;

                    // Add event listener to new cart button
                    const newCartButton = actionsDiv.querySelector('.add-to-cart');
                    if (newCartButton) {
                        newCartButton.addEventListener('click', (e) => {
                            e.stopPropagation();
                            addToCart({ id: productId, name: tile.querySelector('h3').textContent, price: 0, qty: 1 });
                            updateCartDisplay();
                        });
                    }
                }
            }
        }
    });
}

// --- Initialisation DOM ---
document.addEventListener('DOMContentLoaded', async () => {
    const menuToggle = document.getElementById('menu-toggle');
    const leftMenu = document.getElementById('left-menu');
    const menuOverlay = document.getElementById('menu-overlay');
    const searchBar = document.getElementById('search-bar');
    const backButton = document.getElementById('back-button');
    const backSearchButton = document.getElementById('back-search-button');
    const cartButton = document.getElementById('cart-button');

    // Function to toggle menu
    function toggleMenu() {
        const isHidden = leftMenu.classList.contains('hidden');
        if (isHidden) {
            leftMenu.classList.remove('hidden');
            if (menuOverlay) menuOverlay.classList.remove('hidden');
            document.body.classList.add('menu-open');
            closeCartSidebar(); // Close cart sidebar when opening left menu
        } else {
            leftMenu.classList.add('hidden');
            if (menuOverlay) menuOverlay.classList.add('hidden');
            document.body.classList.remove('menu-open');
        }
    }

    // Function to close menu
    function closeMenu() {
        leftMenu.classList.add('hidden');
        if (menuOverlay) menuOverlay.classList.add('hidden');
        document.body.classList.remove('menu-open');
    }

    // Make closeMenu globally accessible
    window.closeMenu = closeMenu;

    if (menuToggle && leftMenu) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });
    }

    // Menu close button
    const menuClose = document.getElementById('menu-close');
    if (menuClose && leftMenu) {
        menuClose.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.closeMenu) window.closeMenu();
        });
    }

    // Close menu when clicking on overlay
    if (menuOverlay) {
        menuOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.closeMenu) window.closeMenu();
        });
    }

    // Close menu when clicking outside or on menu links
    document.addEventListener('click', (e) => {
        if (leftMenu && !leftMenu.classList.contains('hidden')) {
            if (!leftMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                if (window.closeMenu) window.closeMenu();
            }
        }
    });

    // Close menu when clicking on menu links
    if (leftMenu) {
        leftMenu.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                if (window.closeMenu) window.closeMenu();
            }
        });
    }

    if (backButton) backButton.addEventListener('click', () => {
        history.back();
    });

    if (backSearchButton) backSearchButton.addEventListener('click', () => {
        history.back();
    });

    if (cartButton) {
        cartButton.addEventListener('click', (e) => {
            e.preventDefault();
            toggleCartSidebar();
        });
    }

    // Cart sidebar event listeners
    const cartSidebarCloseBtn = document.getElementById('cart-sidebar-close');

    if (cartSidebarCloseBtn) {
        cartSidebarCloseBtn.addEventListener('click', closeCartSidebar);
    }

    // Close cart sidebar when clicking outside
    document.addEventListener('click', (e) => {
        const cartSidebar = document.getElementById('cart-sidebar');
        const cartButton = document.getElementById('cart-button');

        if (cartSidebar && !cartSidebar.classList.contains('hidden')) {
            // Check if click is outside the sidebar and not on the cart button
            if (!cartSidebar.contains(e.target) && !cartButton.contains(e.target)) {
                closeCartSidebar();
            }
        }
    });

    // Cart preview modal event listeners (keeping for compatibility)
    const cartPreviewCloseBtn = document.getElementById('cart-preview-close');
    const cartPreviewOverlay = document.querySelector('.cart-preview-overlay');
    const cartPreviewCheckoutBtn = document.getElementById('cart-preview-checkout');

    if (cartPreviewCloseBtn) {
        cartPreviewCloseBtn.addEventListener('click', closeCartPreviewModal);
    }

    if (cartPreviewOverlay) {
        cartPreviewOverlay.addEventListener('click', closeCartPreviewModal);
    }

    if (cartPreviewCheckoutBtn) {
        cartPreviewCheckoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeCartPreviewModal();
            // TODO: Implement checkout flow
            alert('Fonction de commande à implémenter');
        });
    }

    // Store current category and search for cart updates
    window.currentCategoryId = null;
    window.currentSearchQuery = null;

    // Back button on product page (preserve history -> returns to previous filter/search/scroll)
    const backProductBtn = document.getElementById('back-product');
    if (backProductBtn) {
        backProductBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.back();
        });
    }

    if (searchBar) {
        // debounce input to avoid rapid requests + UI flicker
        let searchTimeout = null;
        searchBar.addEventListener('input', function() {
            const q = this.value.trim();
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                if (q.length > 2) {
                    await searchProducts(q);
                } else if (q.length === 0) {
                    showCategoryView();
                }
            }, 300);
        });
    }

    // Charger les catégories et les pays d'origine
    await loadMainCategories();
    await loadOriginCountries();

    // Parse category from URL path (e.g., /index/slug-de-la-category)
    const pathParts = window.location.pathname.split('/').filter(part => part);
    const catSlug = pathParts.length >= 2 && pathParts[0] === 'index' ? pathParts[1] : null;

    if (catSlug) {
        try {
            const categories = await supabaseAPI.getMainCategories();
            const cat = categories.find(c => (c.slug && c.slug === catSlug) || c.unique_id === catSlug);
            if (cat) {
                currentCategoryId = cat.unique_id;
                currentCategoryName = cat.name;
                history.replaceState({ category: cat.slug || cat.unique_id }, '', `/index/${encodeURIComponent(cat.slug || cat.unique_id)}`);
                // load products first, then show view to avoid flicker
                await loadProductsByCategory(cat.unique_id);
                showCategoryProductsView(cat.name);
            }
        } catch (err) {
            console.error('Erreur lors du chargement de la category depuis l\'URL', err);
        }
    }

    // Mettre à jour le compteur du panier à l'ouverture
    updateCartCount();

    // Listen for browser back/forward buttons
    window.addEventListener('popstate', async (event) => {
        if (event.state && event.state.category) {
            // User navigated to a category
            const catSlug = event.state.category;
            try {
                const categories = await supabaseAPI.getMainCategories();
                const cat = categories.find(c => (c.slug && c.slug === catSlug) || c.unique_id === catSlug);
                if (cat) {
                    currentCategoryId = cat.unique_id;
                    currentCategoryName = cat.name;
                    await loadProductsByCategory(cat.unique_id);
                    showCategoryProductsView(cat.name);
                }
            } catch (err) {
                console.error('Erreur lors de la navigation:', err);
            }
        } else {
            // User navigated back to main page
            showCategoryView();
        }
    });
});

// --- Vues ---
function showCategoryView() {
    const cv = document.getElementById('category-view');
    const cpv = document.getElementById('category-products-view');
    const srv = document.getElementById('search-results-view');
    if (cv) cv.style.display = 'block';
    if (cpv) cpv.style.display = 'none';
    if (srv) srv.style.display = 'none';
    const sb = document.getElementById('search-bar');
    if (sb) sb.value = '';
    currentCategoryId = null;
    currentCategoryName = null;
}

async function showCategoryProductsView(categoryName) {
    const cv = document.getElementById('category-view');
    const cpv = document.getElementById('category-products-view');
    const srv = document.getElementById('search-results-view');
    if (cv) cv.style.display = 'none';
    if (cpv) cpv.style.display = 'block';
    if (srv) srv.style.display = 'none';
    const title = document.getElementById('category-title');
    if (title) title.textContent = categoryName;

    // Update back button text based on category level
    const backButtonText = document.getElementById('back-button-text');
    if (backButtonText && currentCategoryId) {
        try {
            // Check if current category is a main category (level 0)
            const mainCategories = await supabaseAPI.getMainCategories();
            const isMainCategory = mainCategories.some(cat => cat.unique_id === currentCategoryId);

            if (isMainCategory) {
                backButtonText.textContent = 'Accueil';
            } else {
                backButtonText.textContent = 'Retour';
            }
        } catch (err) {
            console.error('Erreur lors de la vérification du niveau de catégorie:', err);
            backButtonText.textContent = 'Retour';
        }
    }
}

function showSearchResultsView(query) {
    const cv = document.getElementById('category-view');
    const cpv = document.getElementById('category-products-view');
    const srv = document.getElementById('search-results-view');
    if (cv) cv.style.display = 'none';
    if (cpv) cpv.style.display = 'none';
    if (srv) srv.style.display = 'block';
    const st = document.getElementById('search-title');
    if (st) st.textContent = `Résultats pour "${query}"`;
}

// --- Chargement des données ---
async function loadMainCategories() {
    try {
        const categories = await supabaseAPI.getMainCategories();
        const categoryGrid = document.querySelector('.category-grid');
        const menuCategoryList = document.getElementById('menu-category-list');

        if (!categoryGrid) return;

        categoryGrid.innerHTML = '';

        if (!categories || categories.length === 0) {
            categoryGrid.innerHTML = '<p class="no-categories">Aucune catégorie disponible</p>';
            return;
        }

        // Display categories in main grid
        categories.forEach(cat => {
            const div = document.createElement('div');
            div.className = 'category-item';
            const imgUrl = normalizeImageUrl(cat.image) || 'placeholder.jpg';
            div.innerHTML = `
                <img src="${imgUrl}" alt="${cat.name}">
                <p>${cat.name}</p>
            `;
            div.addEventListener('click', async () => {
                currentCategoryId = cat.unique_id;
                currentCategoryName = cat.name;
                const slug = cat.slug || cat.unique_id;
                // store current scroll so back can restore it
                history.pushState({ category: slug, scrollY: window.scrollY }, '', `/index/${encodeURIComponent(slug)}`);
                // load products first to avoid UI flash; then show view
                await loadProductsByCategory(cat.unique_id);
                showCategoryProductsView(cat.name);
            });
            categoryGrid.appendChild(div);
        });

        // Display categories in menu
        displayCategoriesInMenu(categories);
    } catch (err) {
        console.error('Erreur loadMainCategories', err);
    }
}

function displayCategoriesInMenu(categories) {
    const menuCategoryList = document.getElementById('menu-category-list');
    if (!menuCategoryList) return;

    menuCategoryList.innerHTML = '';

    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'menu-category-item';
        const imgUrl = normalizeImageUrl(cat.image) || 'placeholder.jpg';

        div.innerHTML = `
            <div class="menu-category-icon">
                <img src="${imgUrl}" alt="${cat.name}">
            </div>
            <span class="menu-category-name">${cat.name}</span>
        `;

        div.addEventListener('click', async (e) => {
            e.stopPropagation();
            currentCategoryId = cat.unique_id;
            currentCategoryName = cat.name;
            const slug = cat.slug || cat.unique_id;
            // store current scroll so back can restore it
            history.pushState({ category: slug, scrollY: window.scrollY }, '', `/index/${encodeURIComponent(slug)}`);
            // load products first to avoid UI flash; then show view
            await loadProductsByCategory(cat.unique_id);
            showCategoryProductsView(cat.name);
            // Update current category for cart updates
            window.currentCategoryId = cat.unique_id;
            window.currentSearchQuery = null;
            // Close menu after category selection
            if (window.closeMenu) window.closeMenu();
        });

        menuCategoryList.appendChild(div);
    });
}

async function loadProductsByCategory(categoryId) {
    try {
        const products = await supabaseAPI.getProductsByCategory(categoryId);
        displayCategoryProducts(products);
    } catch (err) {
        console.error('Erreur loadProductsByCategory', err);
    }
}

async function searchProducts(query) {
    try {
        const products = await supabaseAPI.searchProducts(query);
        showSearchResultsView(query);
        displaySearchProducts(products);
        window.currentSearchQuery = query;
        window.currentCategoryId = null;
    } catch (err) {
        console.error('Erreur searchProducts', err);
    }
}

// Fonction pour charger les pays d'origine
async function loadOriginCountries() {
    try {
        const countries = await supabaseAPI.getOriginCountries();
        originCountriesMap.clear();

        // Créer une Map pour un accès rapide par unique_id
        countries.forEach(country => {
            if (country.unique_id && country.name) {
                originCountriesMap.set(country.unique_id, country.name);
            }
        });

        console.log('Pays d\'origine chargés:', originCountriesMap.size);
    } catch (err) {
        console.error('Erreur lors du chargement des pays d\'origine:', err);
    }
}

// --- Affichage produits ---
function displayCategoryProducts(products) {
    const container = document.getElementById('category-products');
    if (!container) return;

    // build fragment to minimize reflow and flicker
    const frag = document.createDocumentFragment();

    if (!products || products.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'no-products';
        empty.textContent = 'Aucun produit trouvé';
        // replace content
        container.innerHTML = '';
        container.appendChild(empty);
        return;
    }

    products.forEach(p => {
        const tile = document.createElement('div');
        tile.className = 'product-tile';
        const imgUrl = normalizeImageUrl(p.main_picture) || 'placeholder.jpg';
        const cart = getCart();
        const existingItem = cart.find(item => item.id === p.unique_id);
        const quantity = existingItem ? existingItem.qty : 0;

        tile.innerHTML = `
            <div class="product-favorite">
                <button class="favorite-btn" data-id="${p.unique_id}" aria-label="Ajouter aux favoris">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                </button>
            </div>
            <img src="${imgUrl}" alt="${p.name}">
            <h3>${p.name}</h3>
            <div class="product-info">
                ${(() => {
                    // Simple weight display - minimal version
                    let displayWeight = '';

                    try {
                        // Combine poids + os_poids_valeur with conversions
                        if (p.poids && p.os_poids_valeur) {
                            const value = parseFloat(p.poids);

                            // Don't display if value is 0 or negative
                            if (value <= 0) {
                                return '';
                            }

                            const unitMatch = p.os_poids_valeur.toLowerCase().match(/(kg|g|l|ml|pièce|portion|barquette|sachet|paquet)/);
                            let unit = unitMatch ? unitMatch[1] : '';

                            // Apply conversions
                            if (unit === 'kg' && value < 1) {
                                // Convert kg to g
                                unit = 'g';
                                const gramsValue = formatWeightValue(value * 1000);
                                displayWeight = `<div class="product-info-item">${gramsValue} ${unit}</div>`;
                            } else if (unit === 'l' && value < 1) {
                                // Convert L to cl
                                unit = 'cl';
                                const clValue = formatWeightValue(value * 100);
                                displayWeight = `<div class="product-info-item">${clValue} ${unit}</div>`;
                            } else {
                                // No conversion needed
                                const formattedValue = formatWeightValue(value);
                                displayWeight = `<div class="product-info-item">${formattedValue} ${unit}</div>`;
                            }
                        } else if (p.os_poids_valeur && p.os_poids_valeur !== '' && p.os_poids_valeur !== '0') {
                            displayWeight = `<div class="product-info-item">${p.os_poids_valeur}</div>`;
                        } else if (p.poids !== null && p.poids !== undefined && p.poids !== '' && p.poids !== 0) {
                            displayWeight = `<div class="product-info-item">${p.poids}</div>`;
                        }
                    } catch (error) {
                        console.error('Error in weight display:', error);
                        displayWeight = '';
                    }

                    return displayWeight;
                })()}
                ${(() => {
                    // Display origin country if available
                    let displayOrigin = '';
                    if (p.id_origine_country && originCountriesMap.has(p.id_origine_country)) {
                        const countryName = originCountriesMap.get(p.id_origine_country);
                        displayOrigin = `<div class="product-info-item">${countryName}</div>`;
                    }
                    return displayOrigin;
                })()}
                ${p.label || p.labels ? `<div class="product-info-item">${p.label || p.labels}</div>` : ''}
            </div>
            <div class="price-actions-container">
                <div class="price">${formatPrice(p.pv_ttc || 0)}</div>
                <div class="product-actions">
                ${quantity > 0 ? `
                    <div class="quantity-controls">
                        <button class="quantity-btn quantity-decrease" data-id="${p.unique_id}" aria-label="Diminuer quantité">-</button>
                        <span class="quantity-display">${quantity}</span>
                        <button class="quantity-btn quantity-increase" data-id="${p.unique_id}" aria-label="Augmenter quantité">+</button>
                    </div>
                ` : `
                    <button class="add-to-cart" data-id="${p.unique_id}" aria-label="Ajouter au panier" title="Ajouter au panier">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 6H21L20 12H8L6 6Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                            <circle cx="10" cy="19" r="1" fill="currentColor"/>
                            <circle cx="18" cy="19" r="1" fill="currentColor"/>
                        </svg>
                    </button>
                `}
                </div>
            </div>
        `;
        frag.appendChild(tile);

        // Make tile clickable for product details
        tile.classList.add('clickable');
        tile.addEventListener('click', (e) => {
            // Don't navigate if clicking on cart or favorite button
            if (e.target.closest('.add-to-cart') || e.target.closest('.favorite-btn')) {
                return;
            }
            window.location.href = `product.html?id=${p.unique_id}`;
        });

        // Quantity controls event listeners
        tile.querySelector('.quantity-increase')?.addEventListener('click', (e) => {
            e.stopPropagation();
            changeItemQty(p.unique_id, 1);
            updateCartDisplay();
        });

        tile.querySelector('.quantity-decrease')?.addEventListener('click', (e) => {
            e.stopPropagation();
            changeItemQty(p.unique_id, -1);
            updateCartDisplay();
        });

        // Add to cart button (when quantity is 0)
        tile.querySelector('.add-to-cart')?.addEventListener('click', (e) => {
            e.stopPropagation();
            addToCart({ id: p.unique_id, name: p.name, price: p.pv_ttc || 0, qty: 1 });
            updateCartDisplay();
        });

        // Favorite button functionality
        tile.querySelector('.favorite-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            btn.classList.toggle('active');
            console.log('Favorite toggled for product:', p.unique_id);
        });
    });

    // replace content in one operation
    container.innerHTML = '';
    container.appendChild(frag);

    // After append, ensure add-to-cart buttons show icon (in case text changed)
    container.querySelectorAll('.add-to-cart').forEach(btn => {
        // if innerText added, restore icon markup if needed (simple approach: if text present, reset to svg)
        if (btn.textContent && btn.textContent.trim() === 'Ajouté') {
            // keep "Ajouté" briefly, but ensure structure contains svg — do nothing
        }
    });
}

function displaySearchProducts(products) {
    const container = document.getElementById('search-products');
    if (!container) return;

    const frag = document.createDocumentFragment();

    if (!products || products.length === 0) {
        container.innerHTML = '<p class="no-products">Aucun résultat</p>';
        return;
    }

    products.forEach(p => {
        const tile = document.createElement('div');
        tile.className = 'product-tile';
        const imgUrl = normalizeImageUrl(p.main_picture) || 'placeholder.jpg';
        const cart = getCart();
        const existingItem = cart.find(item => item.id === p.unique_id);
        const quantity = existingItem ? existingItem.qty : 0;

        tile.innerHTML = `
            <div class="product-favorite">
                <button class="favorite-btn" data-id="${p.unique_id}" aria-label="Ajouter aux favoris">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                </button>
            </div>
            <img src="${imgUrl}" alt="${p.name}">
            <h3>${p.name}</h3>
            <div class="product-info">
                ${p.weight ? `<div class="weight">${p.weight}</div>` : ''}
                ${(() => {
                    // Display origin country if available
                    let displayOrigin = '';
                    if (p.id_origine_country && originCountriesMap.has(p.id_origine_country)) {
                        const countryName = originCountriesMap.get(p.id_origine_country);
                        displayOrigin = `<div class="product-info-item">${countryName}</div>`;
                    }
                    return displayOrigin;
                })()}
            </div>
            <div class="price-actions-container">
                <div class="price">${formatPrice(p.pv_ttc || 0)}</div>
                <div class="product-actions">
                ${quantity > 0 ? `
                    <div class="quantity-controls">
                        <button class="quantity-btn quantity-decrease" data-id="${p.unique_id}" aria-label="Diminuer quantité">-</button>
                        <span class="quantity-display">${quantity}</span>
                        <button class="quantity-btn quantity-increase" data-id="${p.unique_id}" aria-label="Augmenter quantité">+</button>
                    </div>
                ` : `
                    <button class="add-to-cart" data-id="${p.unique_id}" aria-label="Ajouter au panier" title="Ajouter au panier">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 6H21L20 12H8L6 6Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                            <circle cx="10" cy="19" r="1" fill="currentColor"/>
                            <circle cx="18" cy="19" r="1" fill="currentColor"/>
                        </svg>
                    </button>
                `}
                </div>
            </div>
        `;
        frag.appendChild(tile);

        // Make tile clickable for product details
        tile.classList.add('clickable');
        tile.addEventListener('click', (e) => {
            // Don't navigate if clicking on cart or favorite button
            if (e.target.closest('.add-to-cart') || e.target.closest('.favorite-btn')) {
                return;
            }
            window.location.href = `product.html?id=${p.unique_id}`;
        });

        // Quantity controls event listeners
        tile.querySelector('.quantity-increase')?.addEventListener('click', (e) => {
            e.stopPropagation();
            changeItemQty(p.unique_id, 1);
            updateCartDisplay();
        });

        tile.querySelector('.quantity-decrease')?.addEventListener('click', (e) => {
            e.stopPropagation();
            changeItemQty(p.unique_id, -1);
            updateCartDisplay();
        });

        // Add to cart button (when quantity is 0)
        tile.querySelector('.add-to-cart')?.addEventListener('click', (e) => {
            e.stopPropagation();
            addToCart({ id: p.unique_id, name: p.name, price: p.pv_ttc || 0, qty: 1 });
            updateCartDisplay();
        });

        // Favorite button functionality
        tile.querySelector('.favorite-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            btn.classList.toggle('active');
            console.log('Favorite toggled for product:', p.unique_id);
        });
    });

    container.innerHTML = '';
    container.appendChild(frag);
}

// --- Cart sidebar helpers ---
function toggleCartSidebar() {
    const sidebar = document.getElementById('cart-sidebar');
    if (!sidebar) return;

    const isHidden = sidebar.classList.contains('hidden');
    if (isHidden) {
        openCartSidebar();
    } else {
        closeCartSidebar();
    }
}

function openCartSidebar() {
    const sidebar = document.getElementById('cart-sidebar');
    if (!sidebar) return;
    if (window.closeMenu) window.closeMenu(); // Close left menu if open
    renderCartSidebar();
    sidebar.classList.remove('hidden');
    // prevent body scroll while sidebar open
    document.body.classList.add('modal-open');
}

function closeCartSidebar() {
    const sidebar = document.getElementById('cart-sidebar');
    if (!sidebar) return;
    sidebar.classList.add('hidden');
    // restore body scrolling
    document.body.classList.remove('modal-open');
}

// --- Cart preview modal helpers ---
function openCartPreviewModal() {
    const modal = document.getElementById('cart-preview-modal');
    if (!modal) return;
    if (window.closeMenu) window.closeMenu(); // Close left menu if open
    renderCartPreviewModal();
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    // prevent body scroll while modal open
    document.body.classList.add('modal-open');
}

function closeCartPreviewModal() {
    const modal = document.getElementById('cart-preview-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    // restore body scrolling
    document.body.classList.remove('modal-open');
}

// Close cart preview when clicking outside
document.addEventListener('click', (e) => {
    const cartPreviewModal = document.getElementById('cart-preview-modal');
    const cartButton = document.getElementById('cart-button');

    if (cartPreviewModal && !cartPreviewModal.classList.contains('hidden')) {
        // Check if click is outside the modal content and not on the cart button
        if (!cartPreviewModal.contains(e.target) && !cartButton.contains(e.target)) {
            closeCartPreviewModal();
        }
    }
});

// Fonction helper pour récupérer l'image d'un produit
async function getProductImage(productId) {
    try {
        const product = await supabaseAPI.getProductById(productId);
        return product ? normalizeImageUrl(product.main_picture) : 'placeholder.jpg';
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'image du produit:', error);
        return 'placeholder.jpg';
    }
}

async function renderCartSidebar() {
    const contentContainer = document.getElementById('cart-sidebar-content');

    if (!contentContainer) return;

    const cart = getCart();
    contentContainer.innerHTML = '';

    if (!cart || cart.length === 0) {
        contentContainer.innerHTML = `
            <div class="cart-sidebar-empty">
                <p>Votre panier est vide</p>
                <p style="font-size: 0.9rem; color: #6c757d; margin-top: 0.5rem;">Ajoutez des produits pour commencer vos achats</p>
            </div>
        `;
        return;
    }

    // Create cart items list
    const itemsList = document.createElement('div');
    itemsList.className = 'cart-sidebar-items';

    // Récupérer les images pour tous les produits du panier
    const imagePromises = cart.map(item => getProductImage(item.id));
    const images = await Promise.all(imagePromises);

    cart.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-sidebar-item';
        itemDiv.innerHTML = `
            <div class="cart-sidebar-item-image">
                <img src="${images[index]}" alt="${item.name}">
            </div>
            <div class="cart-sidebar-item-details">
                <div class="cart-sidebar-item-name">${item.name}</div>
                <div class="cart-sidebar-item-price">${formatPrice(item.price || 0)}</div>
                <div class="cart-sidebar-item-quantity">
                    <button class="cart-sidebar-qty-decr" data-id="${item.id}" aria-label="Diminuer">−</button>
                    <span>${item.qty}</span>
                    <button class="cart-sidebar-qty-incr" data-id="${item.id}" aria-label="Augmenter">+</button>
                </div>
            </div>
            <div class="cart-sidebar-item-remove">
                <button class="cart-sidebar-remove" data-id="${item.id}" aria-label="Supprimer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        `;
        itemsList.appendChild(itemDiv);
    });

    // Create footer with total and checkout
    const footer = document.createElement('div');
    footer.className = 'cart-sidebar-footer';
    footer.innerHTML = `
        <div class="cart-sidebar-total">
            <span>Total :</span>
            <strong>${formatPrice(calculateCartTotal())}</strong>
        </div>
        <div class="cart-sidebar-actions">
            <button class="btn-secondary" id="cart-sidebar-clear">Vider le panier</button>
            <button class="btn-primary" id="cart-sidebar-checkout">Commander</button>
        </div>
    `;

    contentContainer.appendChild(itemsList);
    contentContainer.appendChild(footer);

    // Attach events for quantity buttons
    contentContainer.querySelectorAll('.cart-sidebar-qty-incr').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = e.currentTarget.getAttribute('data-id');
            changeItemQty(id, 1);
            renderCartSidebar();
            updateCartDisplay();
        });
    });
    contentContainer.querySelectorAll('.cart-sidebar-qty-decr').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = e.currentTarget.getAttribute('data-id');
            changeItemQty(id, -1);
            renderCartSidebar();
            updateCartDisplay();
        });
    });
    contentContainer.querySelectorAll('.cart-sidebar-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = e.currentTarget.getAttribute('data-id');
            removeCartItem(id);
            renderCartSidebar();
            updateCartDisplay();
        });
    });

    // Attach events for footer buttons
    const clearBtn = contentContainer.querySelector('#cart-sidebar-clear');
    const checkoutBtn = contentContainer.querySelector('#cart-sidebar-checkout');

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Vider le panier ?')) {
                saveCart([]);
                renderCartSidebar();
                updateCartDisplay();
            }
        });
    }

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            // TODO: Implement checkout flow
            alert('Fonction de commande à implémenter');
        });
    }
}

function renderCartPreviewModal() {
    const itemsContainer = document.getElementById('cart-preview-items');
    const totalEl = document.getElementById('cart-preview-total-amount');

    if (!itemsContainer) return;

    const cart = getCart();
    itemsContainer.innerHTML = '';

    if (!cart || cart.length === 0) {
        itemsContainer.innerHTML = `
            <div class="cart-preview-empty">
                <p>Votre panier est vide</p>
            </div>
        `;
        if (totalEl) totalEl.textContent = formatPrice(0);
        return;
    }

    // Show only first 3 items for preview
    const previewItems = cart.slice(0, 3);
    const hasMoreItems = cart.length > 3;

    previewItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-preview-item';
        itemDiv.innerHTML = `
            <img src="placeholder.jpg" alt="${item.name}">
            <div class="cart-preview-item-details">
                <div class="cart-preview-item-name">${item.name}</div>
                <div class="cart-preview-item-price">${formatPrice(item.price || 0)}</div>
            </div>
            <div class="cart-preview-item-quantity">
                <button class="cart-preview-qty-decr" data-id="${item.id}" aria-label="Diminuer">−</button>
                <span>${item.qty}</span>
                <button class="cart-preview-qty-incr" data-id="${item.id}" aria-label="Augmenter">+</button>
            </div>
        `;
        itemsContainer.appendChild(itemDiv);
    });

    // Add "and X more items" if there are more than 3
    if (hasMoreItems) {
        const moreDiv = document.createElement('div');
        moreDiv.className = 'cart-preview-item';
        moreDiv.innerHTML = `
            <div style="width: 40px; height: 40px; background: #f8f9fa; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #6c757d; font-size: 0.8rem;">
                +${cart.length - 3}
            </div>
            <div class="cart-preview-item-details">
                <div class="cart-preview-item-name">${cart.length - 3} autre${cart.length - 3 > 1 ? 's' : ''} article${cart.length - 3 > 1 ? 's' : ''}</div>
            </div>
        `;
        itemsContainer.appendChild(moreDiv);
    }

    // attach events for quantity buttons
    itemsContainer.querySelectorAll('.cart-preview-qty-incr').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = e.currentTarget.getAttribute('data-id');
            changeItemQty(id, 1);
            renderCartPreviewModal();
            updateCartDisplay();
        });
    });
    itemsContainer.querySelectorAll('.cart-preview-qty-decr').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = e.currentTarget.getAttribute('data-id');
            changeItemQty(id, -1);
            renderCartPreviewModal();
            updateCartDisplay();
        });
    });

    if (totalEl) totalEl.textContent = formatPrice(calculateCartTotal());
}

// --- Cart modal helpers ---
function openCartModal() {
    const modal = document.getElementById('cart-modal');
    if (!modal) return;
    renderCartModal();
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    // prevent body scroll while modal open
    document.body.classList.add('modal-open');
    // attach overlay / close
    const overlay = modal.querySelector('.modal-overlay');
    if (overlay) overlay.addEventListener('click', closeCartModal);
    const closeBtn = document.getElementById('cart-close');
    if (closeBtn) closeBtn.addEventListener('click', closeCartModal);
}

function closeCartModal() {
    const modal = document.getElementById('cart-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    // restore body scrolling
    document.body.classList.remove('modal-open');
}

function renderCartModal() {
    const itemsContainer = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total-amount');
    const clearBtn = document.getElementById('cart-clear');
    const checkoutBtn = document.getElementById('cart-checkout');

    if (!itemsContainer) return;

    const cart = getCart();
    itemsContainer.innerHTML = '';

    if (!cart || cart.length === 0) {
        itemsContainer.innerHTML = '<p class="no-products">Votre panier est vide</p>';
        if (totalEl) totalEl.textContent = formatPrice(0);
        return;
    }

    cart.forEach(item => {
        const row = document.createElement('div');
        row.className = 'cart-item';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '0.75rem';
        row.style.padding = '0.5rem 0';
        row.innerHTML = `
            <div style="flex:0 0 48px;">
                <img src="placeholder.jpg" alt="${item.name}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">
            </div>
            <div style="flex:1;">
                <div style="font-weight:600">${item.name}</div>
                <div style="color:#6c757d;font-size:0.9rem">${formatPrice(item.price || 0)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem;">
                <button class="cart-qty-decr" data-id="${item.id}" aria-label="Diminuer">−</button>
                <span class="cart-qty" data-id="${item.id}">${item.qty}</span>
                <button class="cart-qty-incr" data-id="${item.id}" aria-label="Augmenter">+</button>
            </div>
            <div style="flex:0 0 60px;text-align:right;">
                <div style="font-weight:600">${formatPrice((item.price || 0) * (item.qty || 1))}</div>
                <button class="cart-remove" data-id="${item.id}" style="background:none;border:none;color:#e74c3c;cursor:pointer;margin-top:4px;">Supprimer</button>
            </div>
        `;
        itemsContainer.appendChild(row);
    });

    // attach events
    itemsContainer.querySelectorAll('.cart-qty-incr').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            changeItemQty(id, 1);
            renderCartModal();
        });
    });
    itemsContainer.querySelectorAll('.cart-qty-decr').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            changeItemQty(id, -1);
            renderCartModal();
        });
    });
    itemsContainer.querySelectorAll('.cart-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            removeCartItem(id);
            renderCartModal();
        });
    });

    if (totalEl) totalEl.textContent = formatPrice(calculateCartTotal());

    if (clearBtn) {
        clearBtn.onclick = () => {
            if (confirm('Vider le panier ?')) {
                saveCart([]);
                renderCartModal();
            }
        };
    }
    if (checkoutBtn) {
        checkoutBtn.onclick = () => {
            // placeholder checkout flow
            alert('Passer à la caisse — fonctionnalité à implémenter');
        };
    }
}

function calculateCartTotal() {
    const cart = getCart();
    return cart.reduce((sum, it) => sum + ((it.price || 0) * (it.qty || 0)), 0);
}

function changeItemQty(id, delta) {
    const cart = getCart();
    const item = cart.find(c => c.id === id);
    if (!item) return;
    item.qty = Math.max(0, (item.qty || 0) + delta);
    if (item.qty === 0) {
        // remove
        const idx = cart.findIndex(c => c.id === id);
        if (idx !== -1) cart.splice(idx, 1);
    }
    saveCart(cart);
}

function removeCartItem(id) {
    const cart = getCart();
    const idx = cart.findIndex(c => c.id === id);
    if (idx === -1) return;
    cart.splice(idx, 1);
    saveCart(cart);
}

// --- Utilitaires ---
function formatPrice(price) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
}