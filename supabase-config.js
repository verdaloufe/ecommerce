// Configuration Supabase
const SUPABASE_URL = 'https://hshqsadlehbzfsmvsced.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzaHFzYWRsZWhiemZzbXZzY2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwNzUxODEsImV4cCI6MjA1NjY1MTE4MX0.yQv_zgk4wQibHSTp5Y2SZkHO-FROapHrN73wEBw4GOY';

// Initialisation Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fonctions pour interagir avec Supabase (lecture seule)
const supabaseAPI = {
    // Récupérer toutes les catégories principales (niveau 0)
    async getMainCategories() {
        console.log('Tentative de récupération des catégories depuis Supabase...');
        try {
            const { data, error } = await supabase
                .from('cat_0_live')
                .select('*')
                .order('name');
            
            if (error) {
                console.error('Erreur lors de la récupération des catégories:', error);
                console.error('Détails de l\'erreur:', error.message, error.details);
                return [];
            }
            
            console.log('Structure des données récupérées:', data.length > 0 ? Object.keys(data[0]) : 'Aucune donnée');
            console.log('Exemple de données image:', data.length > 0 ? data[0].image : 'Aucune donnée');
            console.log('Catégories récupérées avec succès:', data);
            return data;
        } catch (catchError) {
            console.error('Erreur inattendue dans getMainCategories:', catchError);
            return [];
        }
    },

    // Récupérer les sous-catégories d'une catégorie parent
    async getSubCategories(parentId) {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('parent_id', parentId)
            .order('nom');
        
        if (error) {
            console.error('Erreur lors de la récupération des sous-catégories:', error);
            return [];
        }
        return data;
    },

    // Récupérer les produits d'une catégorie
    async getProductsByCategory(categoryId) {
        console.log('Récupération des produits pour la catégorie:', categoryId);
        const { data, error } = await supabase
            .from('produit_live')
            .select('*')
            .contains('id_cat_0_list', [categoryId])
            .order('name');

        if (error) {
            console.error('Erreur lors de la récupération des produits:', error);
            return [];
        }
        console.log('Produits récupérés:', data.length);
        return data;
    },

    // Rechercher des produits par nom
    async searchProducts(query) {
        console.log('Recherche de produits avec le terme:', query);
        const { data, error } = await supabase
            .from('produit_live')
            .select('*')
            .ilike('name', `%${query}%`)
            .order('name');
        
        if (error) {
            console.error('Erreur lors de la recherche:', error);
            console.error('Détails de l\'erreur:', error.message, error.details);
            return [];
        }
        console.log('Produits trouvés:', data.length);
        return data;
    },

    // Récupérer un produit par ID (unique_id)
    async getProductById(productId) {
        try {
            // Le produit utilise `unique_id` comme clé primaire dans la table produit_live
            const { data, error } = await supabase
                .from('produit_live')
                .select('*')
                .eq('unique_id', productId)
                .single();
            
            if (error) {
                console.error('Erreur lors de la récupération du produit:', error);
                return null;
            }
            return data;
        } catch (catchError) {
            console.error('Erreur inattendue dans getProductById:', catchError);
            return null;
        }
    },

    // Récupérer les catégories avec hiérarchie (catégorie 0, 1, 2)
    async getCategoriesHierarchy() {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('niveau, nom');
        
        if (error) {
            console.error('Erreur lors de la récupération des catégories:', error);
            return [];
        }
        return data;
    },

    // Récupérer les labels disponibles
    async getLabels() {
        const { data, error } = await supabase
            .from('labels')
            .select('*')
            .order('nom');
        
        if (error) {
            console.error('Erreur lors de la récupération des labels:', error);
            return [];
        }
        return data;
    },

    // Récupérer les origines disponibles
    async getOrigins() {
        const { data, error } = await supabase
            .from('origines')
            .select('*')
            .order('nom');

        if (error) {
            console.error('Erreur lors de la récupération des origines:', error);
            return [];
        }
        return data;
    },

    // Récupérer les pays d'origine
    async getOriginCountries() {
        const { data, error } = await supabase
            .from('origine_pays')
            .select('*')
            .order('name');

        if (error) {
            console.error('Erreur lors de la récupération des pays d\'origine:', error);
            return [];
        }
        return data;
    }
};

// Exporter pour utilisation globale
window.supabaseAPI = supabaseAPI;