// Variables globales
let currentCategoryId = null;
let currentCategoryName = null;

// Préfixe https: si l'URL commence par //
function normalizeImageUrl(url) {
    if (!url) return null;
    url = String(url).trim();
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url;
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
    if (!el) return;
    const cart = getCart();
    const total = cart.reduce((s, it) => s + (it.qty || 0), 0);
    el.textContent = total;
}

// --- Initialisation DOM ---
document.addEventListener('DOMContentLoaded', async () => {
    const menuToggle = document.getElementById('menu-toggle');
    const leftMenu = document.getElementById('left-menu');
    const searchBar = document.getElementById('search-bar');
    const backButton = document.getElementById('back-button');
    const backSearchButton = document.getElementById('back-search-button');
    const cartButton = document.getElementById('cart-button');

    if (menuToggle && leftMenu) {
        menuToggle.addEventListener('click', () => leftMenu.classList.toggle('hidden'));
    }

    if (backButton) backButton.addEventListener('click', () => {
        history.pushState({}, '', window.location.pathname);
        showCategoryView();
    });

    if (backSearchButton) backSearchButton.addEventListener('click', () => {
        history.pushState({}, '', window.location.pathname);
        showCategoryView();
    });

    if (cartButton) {
        cartButton.addEventListener('click', (e) => {
            e.preventDefault();
            openCartModal();
        });
    }

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

    // Charger les catégories puis gérer param ?category=slug
    await loadMainCategories();

    const params = new URLSearchParams(window.location.search);
    const catSlug = params.get('category');
    if (catSlug) {
        try {
            const categories = await supabaseAPI.getMainCategories();
            const cat = categories.find(c => (c.slug && c.slug === catSlug) || c.unique_id === catSlug);
            if (cat) {
                currentCategoryId = cat.unique_id;
                currentCategoryName = cat.name;
                history.replaceState({ category: cat.slug || cat.unique_id }, '', `?category=${encodeURIComponent(cat.slug || cat.unique_id)}`);
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

function showCategoryProductsView(categoryName) {
    const cv = document.getElementById('category-view');
    const cpv = document.getElementById('category-products-view');
    const srv = document.getElementById('search-results-view');
    if (cv) cv.style.display = 'none';
    if (cpv) cpv.style.display = 'block';
    if (srv) srv.style.display = 'none';
    const title = document.getElementById('category-title');
    if (title) title.textContent = categoryName;
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
        if (!categoryGrid) return;

        categoryGrid.innerHTML = '';

        if (!categories || categories.length === 0) {
            categoryGrid.innerHTML = '<p class="no-categories">Aucune catégorie disponible</p>';
            return;
        }

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
                history.pushState({ category: slug, scrollY: window.scrollY }, '', `?category=${encodeURIComponent(slug)}`);
                // load products first to avoid UI flash; then show view
                await loadProductsByCategory(cat.unique_id);
                showCategoryProductsView(cat.name);
            });
            categoryGrid.appendChild(div);
        });
    } catch (err) {
        console.error('Erreur loadMainCategories', err);
    }
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
    } catch (err) {
        console.error('Erreur searchProducts', err);
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
        tile.innerHTML = `
            <img src="${imgUrl}" alt="${p.name}" onerror="this.src='placeholder.jpg'">
            <h3>${p.name}</h3>
            <div class="price">${formatPrice(p.pv_ttc || 0)}</div>
            <div class="product-actions">
                <a class="view-link" href="product.html?id=${p.unique_id}">Voir le produit</a>
                <button class="add-to-cart" data-id="${p.unique_id}" aria-label="Ajouter au panier" title="Ajouter au panier">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 6H21L20 12H8L6 6Z" stroke="#ff7a00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="10" cy="19" r="1" fill="#ff7a00"/>
                        <circle cx="18" cy="19" r="1" fill="#ff7a00"/>
                    </svg>
                </button>
            </div>
        `;
        frag.appendChild(tile);

        // attach event listeners on the created element
        tile.querySelector('.add-to-cart')?.addEventListener('click', (e) => {
            addToCart({ id: p.unique_id, name: p.name, price: p.pv_ttc || 0, qty: 1 });
            const btn = e.currentTarget;
            btn.textContent = 'Ajouté';
            setTimeout(() => btn.textContent = '', 1200); // icon-only for next state; we'll reset to icon in render
            // update count
            updateCartCount();
            // re-rendering icon text reset handled by leave as is (icon-only)
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
        tile.innerHTML = `
            <img src="${imgUrl}" alt="${p.name}" onerror="this.src='placeholder.jpg'">
            <h3>${p.name}</h3>
            <div class="price">${formatPrice(p.pv_ttc || 0)}</div>
            <div class="product-actions">
                <a class="view-link" href="product.html?id=${p.unique_id}">Voir le produit</a>
                <button class="add-to-cart" data-id="${p.unique_id}" aria-label="Ajouter au panier" title="Ajouter au panier">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 6H21L20 12H8L6 6Z" stroke="#ff7a00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="10" cy="19" r="1" fill="#ff7a00"/>
                        <circle cx="18" cy="19" r="1" fill="#ff7a00"/>
                    </svg>
                </button>
            </div>
        `;
        frag.appendChild(tile);

        tile.querySelector('.add-to-cart')?.addEventListener('click', (e) => {
            addToCart({ id: p.unique_id, name: p.name, price: p.pv_ttc || 0, qty: 1 });
            const btn = e.currentTarget;
            btn.textContent = 'Ajouté';
            setTimeout(() => btn.textContent = '', 1200);
            updateCartCount();
        });
    });

    container.innerHTML = '';
    container.appendChild(frag);
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