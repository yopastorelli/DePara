/**
 * Script para testar o slideshow
 * Autor: yopastorelli
 * Versão: 1.0.0
 */

// Testar se o slideshow está funcionando
function testSlideshow() {
    console.log('🎬 Testando slideshow...');
    
    // Verificar se a classe DeParaUI existe
    if (typeof window.deParaUI === 'undefined') {
        console.error('❌ DeParaUI não encontrada');
        return false;
    }
    
    // Verificar se os métodos do slideshow existem
    const requiredMethods = [
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
    
    const missingMethods = requiredMethods.filter(method => 
        typeof window.deParaUI[method] !== 'function'
    );
    
    if (missingMethods.length > 0) {
        console.error('❌ Métodos do slideshow não encontrados:', missingMethods);
        return false;
    }
    
    console.log('✅ Todos os métodos do slideshow encontrados');
    
    // Verificar se os elementos HTML existem
    const requiredElements = [
        'slideshow-config-modal',
        'slideshow-interval',
        'slideshow-random',
        'slideshow-preload',
        'slideshow-recursive'
    ];
    
    const missingElements = requiredElements.filter(id => 
        !document.getElementById(id)
    );
    
    if (missingElements.length > 0) {
        console.error('❌ Elementos HTML do slideshow não encontrados:', missingElements);
        return false;
    }
    
    console.log('✅ Todos os elementos HTML do slideshow encontrados');
    
    // Testar configurações
    console.log('🔧 Testando configurações...');
    
    // Carregar configurações
    window.deParaUI.loadSlideshowConfig();
    console.log('📋 Configurações carregadas:', window.deParaUI.slideshowConfig);
    
    // Aplicar configurações ao modal
    window.deParaUI.applySlideshowConfigToModal();
    console.log('✅ Configurações aplicadas ao modal');
    
    // Verificar se os valores foram aplicados
    const interval = document.getElementById('slideshow-interval').value;
    const random = document.getElementById('slideshow-random').checked;
    const preload = document.getElementById('slideshow-preload').checked;
    const recursive = document.getElementById('slideshow-recursive').checked;
    
    console.log('📊 Valores no modal:', {
        interval: interval,
        random: random,
        preload: preload,
        recursive: recursive
    });
    
    // Testar aplicação de configurações do modal
    document.getElementById('slideshow-interval').value = '5';
    document.getElementById('slideshow-random').checked = true;
    document.getElementById('slideshow-preload').checked = true;
    document.getElementById('slideshow-recursive').checked = true;
    
    window.deParaUI.applySlideshowConfigFromModal();
    console.log('✅ Configurações aplicadas do modal:', window.deParaUI.slideshowConfig);
    
    // Verificar se foi salvo
    const saved = localStorage.getItem('slideshowConfig');
    if (saved) {
        console.log('💾 Configurações salvas no localStorage:', JSON.parse(saved));
    } else {
        console.warn('⚠️ Configurações não foram salvas no localStorage');
    }
    
    console.log('🎉 Teste do slideshow concluído com sucesso!');
    return true;
}

// Executar teste quando a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testSlideshow);
} else {
    testSlideshow();
}
