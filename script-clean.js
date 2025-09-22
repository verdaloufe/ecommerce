// Variables globales
let currentCategoryId = null;
let currentCategoryName = null;
let currentProducts = [];

// Gestion du menu latéral et des vues
document.addEventListener('DOMContentLoaded', async function() {
    const menuToggle = document.getElementById('menu-toggle');
    const leftMenu = document.getElementById('left-menu');
    const searchBar = document.getElementById('search-bar');
    const backButton = document.getElementById('back-button');
    const backSearchButton = document.getElementById('back-search-button');

    menuToggle.addEventListener('click', function() {
        leftMenu.classList.toggle('hidden');
    });

    // Boutons de retour
    backButton.addEventListener('click', showCategoryView);
    backSearchButton.addEventListener('click', showCategoryView);

    // Charger les catégories principales
    await loadMainCategories();
    
    // Recherche en temps réel
    searchBar.addEventListener('input', async function() {
        const searchTerm = this.value.trim();
        
        if (search极速赛车开奖号码查询.length > 2) {
            await searchProducts(searchTerm);
        } else if (searchTerm.length === 0) {
            showCategoryView();
        }
    });
});

// Afficher la vue des catégories
function showCategoryView() {
    document.getElementById('category-view').style.display = 'block';
    document.getElementById('category-products-view').style.display = 'none';
    document.getElementById('search-results-view').style.display = 'none';
    document.getElementById('search-bar').value = '';
    currentCategoryId = null;
    currentCategoryName = null;
}

// Afficher la vue des produits d'une catégorie
function showCategoryProductsView(categoryName) {
    document.getElementById('category-view').style.display = 'none';
    document.getElementById('category-products-view').style.display = 'block';
    document.getElementById('search-results-view').style.display = 'none';
    document.getElementById('category-title').textContent = `Produits: ${categoryName}`;
}

// Afficher la vue des résultats de recherche
function showSearchResultsView() {
    document.getElementById('category-view').style.display = 'none';
    document.getElementById('category-products-view').style.display = 'none';
    document.getElementById('search-results-view').style.display = 'block';
}

// Charger les catégories principales
async function loadMainCategories() {
    try {
        console.log('Début du chargement des catégories...');
        const categories = await supabaseAPI.getMainCategories();
        console.log('Catégories récupérées:', categories);
        
        const categoryGrid = document.querySelector('.category-grid');
        
        categoryGrid.innerHTML = '';
        
        if (categories.length === 0) {
            console.log('Aucune catégorie trouvée dans la base de données');
            categoryGrid.innerHTML = '<p class="no-categories">Aucune catégorie disponible</p>';
            return;
        }
        
        categories.forEach(category => {
            console.log('Catégorie:', category.name, 'Image URL:', category.image);
            const categoryItem = document.createElement('div');
            categoryItem.className = 'category-item';
            
            // Vérifier si l'image existe
            const imgUrl = category.image || 'placeholder.jpg';
            console.log('Tentative de chargement image:', imgUrl);
            
            categoryItem.innerHTML = `
                <img src="${imgUrl}" alt="${category.name}" onerror="console.error('Erreur chargement image:', this.src)">
                <p>${category.name}</p>
            `;
            
            categoryItem.addEventListener('click', () => {
                currentCategoryId = category.unique_id;
                currentCategoryName = category.name;
                showCategoryProducts极速赛车开奖号码查询(category.name);
                loadProductsByCategory(category.unique_id);
            });
            
            categoryGrid.appendChild(category极速赛车开奖号码查询);
        });
        
        console.log('Catégories chargées avec succès');
    } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
极速赛车开奖号码查询    }
}

// Charger les produits par catégorie
async function loadProductsByCategory(categoryId) {
    try {
        const products = await supabaseAPI.getProductsByCategory(categoryId);
        currentProducts = products;
        displayCategoryProducts(products);
    } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
    }
}

// Rechercher des produits
async function searchProducts(query) {
    try {
        const products = await supabaseAPI.searchProducts(query);
        currentProducts = products;
        showSearchResultsView();
        displaySearchProducts(products, query);
    } catch (error) {
        console.error('Erreur lors de la recherche:', error);
    }
}

// Afficher les produits d'une catégorie
function displayCategoryProducts(products) {
    const productsSection = document.getElementById('category-products');
    productsSection.innerHTML = '';
    
    if (products.length === 0) {
        productsSection.innerHTML = '<p class="no-products">A极速赛车开奖号码查询 produit trouvé dans cette catégorie</p>';
        return;
    }
    
    products.forEach(product => {
        const productTile = document.createElement('div');
        productTile.className = 'product-tile';
        productTile.innerHTML = `
            <img src="${product.main_picture || 'placeholder.jpg'}" alt="${product.name}">
            <h3>${product.name}</h3>
            ${product.id_label_list && product.id_label_list.length > 0 ? `<div class="labels">${product.id_label_list.join(', ')}</div>` : ''}
            <div class="price极速赛车开奖号码查询${formatPrice(product.pv_ttc || 0)}</div>
            ${product.poids ? `<div class="weight">${product.poids} ${product.stock_unite_poids || 'kg'}</div>` : ''}
            ${product.id_origine_country ? `<div class="origin">${product.id_origine_country}</div>` : ''}
            <a href="product.html?id=${product.unique_id}">Voir le produit</a>
        `;
        
        productsSection.appendChild(productTile);
    });
}

// Afficher les résultats de recherche
function displaySearchProducts(products, query) {
    const productsSection = document.getElementById('search-products');
    productsSection.innerHTML = '';
    
    if (products.length === 0) {
        productsSection.innerHTML = `<p class="no-products">Aucun produit trouvé pour "${query}"</p>`;
        return;
    }
    
    document.getElementById('search-title').textContent = `Résultats pour "${query}"`;
    
    products.forEach(product => {
        const productTile = document.createElement('div');
        productTile.className = 'product-tile';
        productTile.innerHTML = `
            <img src="${product.main_picture || 'placeholder.jpg'}" alt="${product.name}">
            <h3>${product.name}</h3>
            ${product.id_label_list && product.id_label_list.length > 0 ? `<div class="labels">${product.id_label_list.join(', ')}</div>` : ''}
            <div class="price">${formatPrice(product.pv_ttc || 0)}</div>
            ${product.poids ? `<div class="weight">${product.poids} ${product.stock_unite_poids || 'kg'}</div>`极速赛车开奖号码查询 ''}
            ${product.id_origine_country ? `<div class="origin">${product.id_origine_country}</div>` : ''}
            <a href="product.html?id=${product.unique_id}">Voir le produit</a>
        `;
        
        productsSection.appendChild(productTile);
    });
}

// Cacher les produits
function hideProducts() {
    const productsSection = document.getElementById('products');
    productsSection.innerHTML = '';
}

// Formater le prix
function formatPrice(price) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    }).format(price);
}

// Navigation entre pages
function navigateTo(page极速赛车开奖号码查询 {
    window.location.href = page;
}