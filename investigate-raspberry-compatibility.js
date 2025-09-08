// Investigação de compatibilidade específica do Raspberry Pi
console.log('🔍 INVESTIGAÇÃO DE COMPATIBILIDADE RASPBERRY PI');
console.log('==============================================');

// 1. Verificar User Agent
console.log('📱 User Agent:', navigator.userAgent);
console.log('🖥️ Plataforma:', navigator.platform);
console.log('🌐 Linguagem:', navigator.language);

// 2. Verificar capacidades do navegador
console.log('\n🔧 CAPACIDADES DO NAVEGADOR:');
console.log('Canvas:', !!document.createElement('canvas').getContext);
console.log('WebGL:', !!document.createElement('canvas').getContext('webgl'));
console.log('Fullscreen API:', !!document.fullscreenEnabled);
console.log('CSS Transform:', 'transform' in document.documentElement.style);
console.log('CSS Position Fixed:', 'position' in document.documentElement.style);

// 3. Verificar se o elemento foi criado
setTimeout(() => {
    console.log('\n🖼️ VERIFICAÇÃO DO ELEMENTO DINÂMICO:');
    const dynamicElement = document.getElementById('slideshow-image-new');
    if (dynamicElement) {
        console.log('✅ Elemento slideshow-image-new encontrado');
        console.log('📍 Posição:', dynamicElement.getBoundingClientRect());
        console.log('🎨 Estilos aplicados:', {
            display: dynamicElement.style.display,
            position: dynamicElement.style.position,
            top: dynamicElement.style.top,
            left: dynamicElement.style.left,
            transform: dynamicElement.style.transform,
            zIndex: dynamicElement.style.zIndex,
            width: dynamicElement.style.width,
            height: dynamicElement.style.height,
            border: dynamicElement.style.border
        });
        console.log('🖼️ Src da imagem:', dynamicElement.src);
        console.log('👁️ Visível:', dynamicElement.offsetWidth > 0 && dynamicElement.offsetHeight > 0);
    } else {
        console.log('❌ Elemento slideshow-image-new NÃO encontrado');
    }
}, 2000);

// 4. Verificar viewport e dimensões da tela
console.log('\n📐 DIMENSÕES DA TELA:');
console.log('Window size:', window.innerWidth, 'x', window.innerHeight);
console.log('Screen size:', screen.width, 'x', screen.height);
console.log('Device pixel ratio:', window.devicePixelRatio);

// 5. Verificar se está em fullscreen
setTimeout(() => {
    console.log('\n🖥️ ESTADO DO FULLSCREEN:');
    console.log('Fullscreen element:', document.fullscreenElement);
    console.log('Fullscreen enabled:', document.fullscreenEnabled);
}, 1000);

// 6. Verificar CSS disponível
console.log('\n🎨 VERIFICAÇÃO DE CSS:');
const testElement = document.createElement('div');
testElement.style.position = 'fixed';
testElement.style.top = '50%';
testElement.style.left = '50%';
testElement.style.transform = 'translate(-50%, -50%)';
testElement.style.zIndex = '9999';
testElement.style.width = '100px';
testElement.style.height = '100px';
testElement.style.background = 'red';
testElement.style.border = '5px solid blue';
testElement.id = 'test-compatibility-element';
document.body.appendChild(testElement);

setTimeout(() => {
    const rect = testElement.getBoundingClientRect();
    console.log('🧪 Elemento de teste criado:', {
        position: rect,
        visible: rect.width > 0 && rect.height > 0,
        styles: {
            position: testElement.style.position,
            top: testElement.style.top,
            left: testElement.style.left,
            transform: testElement.style.transform
        }
    });
    
    // Remover elemento de teste
    testElement.remove();
}, 1000);

// 7. Verificar se há conflitos de CSS
console.log('\n⚠️ VERIFICAÇÃO DE CONFLITOS:');
const allStyles = document.styleSheets;
console.log('Número de stylesheets:', allStyles.length);

// 8. Verificar se o slideshow viewer está visível
setTimeout(() => {
    const viewer = document.getElementById('slideshow-viewer');
    if (viewer) {
        console.log('\n🎬 ESTADO DO VIEWER:');
        console.log('Display:', viewer.style.display);
        console.log('Visibility:', viewer.style.visibility);
        console.log('Position:', viewer.getBoundingClientRect());
    }
}, 1500);

console.log('\n⏰ Aguardando 3 segundos para coleta completa de dados...');
