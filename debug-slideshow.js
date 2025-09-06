// Script de debug para verificar o slideshow
console.log('🔍 Debug do Slideshow:');

// Verificar se a instância existe
console.log('window.deParaUI existe?', !!window.deParaUI);

if (window.deParaUI) {
    console.log('Configurações do slideshow:', window.deParaUI.slideshowConfig);
    console.log('Método startSlideshowFromModal existe?', typeof window.deParaUI.startSlideshowFromModal);
    console.log('Método applySlideshowConfigFromModal existe?', typeof window.deParaUI.applySlideshowConfigFromModal);
}

// Verificar elementos do modal
console.log('Modal slideshow-config-modal existe?', !!document.getElementById('slideshow-config-modal'));
console.log('Modal slideshow-folder-modal existe?', !!document.getElementById('slideshow-folder-modal'));

// Verificar campos de configuração
console.log('Campo slideshow-interval existe?', !!document.getElementById('slideshow-interval'));
console.log('Campo slideshow-random existe?', !!document.getElementById('slideshow-random'));
console.log('Campo slideshow-preload existe?', !!document.getElementById('slideshow-preload'));

// Verificar botão de iniciar
console.log('Botão start-slideshow-btn existe?', !!document.querySelector('.start-slideshow-btn'));

// Testar função startSlideshow
console.log('Função startSlideshow existe?', typeof window.startSlideshow);

// Verificar se há conflito de modais
const modals = document.querySelectorAll('[id*="slideshow"]');
console.log('Modais de slideshow encontrados:', modals.length);
modals.forEach(modal => {
    console.log('- Modal ID:', modal.id, 'Display:', modal.style.display);
});
