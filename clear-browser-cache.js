// Script para limpar cache do navegador e corrigir erro de sintaxe
console.log('🧹 Limpando cache do navegador...');

// Limpar cache
if ('caches' in window) {
    caches.keys().then(function(names) {
        for (let name of names) {
            caches.delete(name);
        }
        console.log('✅ Cache limpo');
    });
}

// Forçar reload sem cache
console.log('🔄 Recarregando página sem cache...');
window.location.reload(true);

// Se não funcionar, mostrar instruções
setTimeout(() => {
    console.log('💡 Se o erro persistir:');
    console.log('1. Pressione Ctrl+F5 (ou Cmd+Shift+R no Mac)');
    console.log('2. Ou abra o DevTools (F12) > Network > Disable cache');
    console.log('3. Ou limpe o cache manualmente nas configurações do navegador');
}, 1000);
