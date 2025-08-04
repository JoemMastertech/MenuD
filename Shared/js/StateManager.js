/**
 * STATE MANAGER - ARQUITECTURA MODULAR
 * ====================================
 * Maneja estados del sistema usando data-attributes
 * Sin dependencia de !important
 */

class StateManager {
    constructor() {
        this.body = document.body;
        this.states = {
            screen: 'visible',
            layout: 'flex',
            sidebar: 'hidden',
            imageSize: 'small',
            height: 'auto',
            minHeight: 'auto'
        };
        
        this.init();
    }

    init() {
        // Aplicar estados iniciales
        this.applyAllStates();
        
        // Escuchar eventos del sistema
        this.bindEvents();
        
        console.log('StateManager initialized - Zero !important architecture');
    }

    // Métodos para cambiar estados
    setScreenState(state) {
        this.states.screen = state;
        this.body.setAttribute('data-screen', state);
        console.log(`Screen state: ${state}`);
    }

    setLayoutState(layout) {
        this.states.layout = layout;
        this.body.setAttribute('data-layout', layout);
        console.log(`Layout state: ${layout}`);
    }

    setSidebarState(state) {
        this.states.sidebar = state;
        this.body.setAttribute('data-sidebar', state);
        console.log(`Sidebar state: ${state}`);
    }

    setImageSize(size) {
        this.states.imageSize = size;
        this.body.setAttribute('data-image-size', size);
        console.log(`Image size: ${size}`);
    }

    setHeightState(height) {
        this.states.height = height;
        this.body.setAttribute('data-height', height);
        console.log(`Height state: ${height}`);
    }

    setMinHeightState(minHeight) {
        this.states.minHeight = minHeight;
        this.body.setAttribute('data-min-height', minHeight);
        console.log(`Min-height state: ${minHeight}`);
    }

    // Aplicar todos los estados
    applyAllStates() {
        Object.keys(this.states).forEach(key => {
            const dataAttr = this.camelToKebab(key);
            this.body.setAttribute(`data-${dataAttr}`, this.states[key]);
        });
    }

    // Obtener estado actual
    getState(stateName) {
        return this.states[stateName];
    }

    // Obtener todos los estados
    getAllStates() {
        return { ...this.states };
    }

    // Eventos del sistema
    bindEvents() {
        // Responsive breakpoints
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Sidebar toggle
        document.addEventListener('click', (e) => {
            if (e.target.matches('.sidebar-toggle')) {
                this.toggleSidebar();
            }
        });
    }

    // Manejo de resize
    handleResize() {
        const width = window.innerWidth;
        
        if (width <= 768) {
            this.setLayoutState('block');
            this.setSidebarState('hidden');
        } else {
            this.setLayoutState('flex');
            this.setSidebarState('visible');
        }
    }

    // Toggle sidebar
    toggleSidebar() {
        const currentState = this.getState('sidebar');
        const newState = currentState === 'visible' ? 'hidden' : 'visible';
        this.setSidebarState(newState);
    }

    // Utilidad: camelCase a kebab-case
    camelToKebab(str) {
        return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    }

    // Debug: mostrar estados actuales
    debug() {
        console.log('=== STATE MANAGER DEBUG ===');
        console.log('Current states:', this.getAllStates());
        console.log('Body data attributes:', {
            screen: this.body.getAttribute('data-screen'),
            layout: this.body.getAttribute('data-layout'),
            sidebar: this.body.getAttribute('data-sidebar'),
            imageSize: this.body.getAttribute('data-image-size'),
            height: this.body.getAttribute('data-height'),
            minHeight: this.body.getAttribute('data-min-height')
        });
        console.log('=========================');
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.stateManager = new StateManager();
});

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateManager;
}