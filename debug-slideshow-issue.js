/**
 * Script de debug para o slideshow
 * Autor: yopastorelli
 * Versão: 1.0.0
 */

console.log('🔍 Debug do slideshow iniciado...');

// 1. Verificar se a classe DeParaUI existe
if (typeof window.deParaUI === 'undefined') {
    console.error('❌ DeParaUI não encontrada');
    console.log('🔍 Tentando aguardar inicialização...');
    
    // Aguardar até 10 segundos
    let attempts = 0;
    const checkInterval = setInterval(() => {
        attempts++;
        if (typeof window.deParaUI !== 'undefined') {
            console.log('✅ DeParaUI encontrada após', attempts, 'tentativas');
            clearInterval(checkInterval);
            debugSlideshow();
        } else if (attempts >= 50) {
            console.error('❌ DeParaUI não foi encontrada após 10 segundos');
            clearInterval(checkInterval);
        }
    }, 200);
} else {
    debugSlideshow();
}

function debugSlideshow() {
    console.log('🎬 Iniciando debug do slideshow...');
    
    // 2. Verificar métodos do slideshow
    const slideshowMethods = [
        'loadSlideshowConfig',
        'saveSlideshowConfig',
        'applySlideshowConfigFromModal',
        'applySlideshowConfigToModal',
        'startSlideshowFromModal',
        'loadSlideshowImages',
        'preloadImage',
        'preloadNextImage',
        'updateSlideDisplay',
        'startAutoPlay'
    ];
    
    console.log('🔍 Verificando métodos do slideshow...');
    slideshowMethods.forEach(method => {
        if (typeof window.deParaUI[method] === 'function') {
            console.log('✅', method);
        } else {
            console.error('❌', method, 'não encontrado');
        }
    });
    
    // 3. Verificar elementos HTML
    const htmlElements = [
        'slideshow-config-modal',
        'slideshow-interval',
        'slideshow-random',
        'slideshow-preload',
        'slideshow-recursive'
    ];
    
    console.log('🔍 Verificando elementos HTML...');
    htmlElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log('✅', id, 'encontrado');
        } else {
            console.error('❌', id, 'não encontrado');
        }
    });
    
    // 4. Verificar configurações atuais
    console.log('🔍 Verificando configurações atuais...');
    console.log('📋 slideshowConfig:', window.deParaUI.slideshowConfig);
    
    // 5. Verificar localStorage
    const savedConfig = localStorage.getItem('slideshowConfig');
    console.log('💾 Configurações salvas:', savedConfig ? JSON.parse(savedConfig) : 'Nenhuma');
    
    // 6. Testar aplicação de configurações
    console.log('🧪 Testando aplicação de configurações...');
    
    // Definir valores de teste
    document.getElementById('slideshow-interval').value = '5';
    document.getElementById('slideshow-random').checked = true;
    document.getElementById('slideshow-preload').checked = true;
    document.getElementById('slideshow-recursive').checked = true;
    
    // Aplicar configurações
    window.deParaUI.applySlideshowConfigFromModal();
    
    // Verificar se foram aplicadas
    console.log('📊 Configurações após aplicação:', window.deParaUI.slideshowConfig);
    
    // 7. Verificar se foram salvas
    const newSavedConfig = localStorage.getItem('slideshowConfig');
    console.log('💾 Configurações após salvamento:', newSavedConfig ? JSON.parse(newSavedConfig) : 'Nenhuma');
    
    // 8. Testar abertura do modal
    console.log('🧪 Testando abertura do modal...');
    window.deParaUI.showSlideshowModal();
    
    // Aguardar um pouco e verificar se o modal abriu
    setTimeout(() => {
        const modal = document.getElementById('slideshow-config-modal');
        if (modal && modal.style.display !== 'none') {
            console.log('✅ Modal do slideshow aberto com sucesso');
        } else {
            console.error('❌ Modal do slideshow não abriu');
        }
    }, 500);
    
    console.log('🎉 Debug do slideshow concluído!');
}
