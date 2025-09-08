#!/usr/bin/env node

/**
 * Script de debug completo para slideshow
 * Simula exatamente o que o frontend faz
 */

const fs = require('fs').promises;
const path = require('path');

// Simular a função shouldIgnoreFile
const IGNORED_FILES = [
  '.sync', '!sync', '*.!sync', '*.sync', '.resilio-sync', 'resilio-sync',
  '.DS_Store', 'Thumbs.db', 'desktop.ini', '.directory',
  '*.tmp', '*.temp', '~$*', '*.bak', '*.backup',
  '*.log', '*.log.*', '.git', '.gitignore', '.svn', '.hg',
  '.Trash', '.fseventsd', '.Spotlight-V100', '.Trashes', '.AppleDouble', '.LSOverride'
];

function shouldIgnoreFile(fileName) {
  if (!fileName || typeof fileName !== 'string') return false;
  const fileNameLower = fileName.toLowerCase();
  
  for (const pattern of IGNORED_FILES) {
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
      if (new RegExp(regexPattern, 'i').test(fileNameLower)) {
        return true;
      }
    } else {
      if (fileNameLower === pattern.toLowerCase()) {
        return true;
      }
    }
  }
  return false;
}

async function debugSlideshowPath(testPath) {
  console.log('🚀 DEBUG COMPLETO DO SLIDESHOW');
  console.log('=' .repeat(80));
  console.log(`📁 Caminho de teste: ${testPath}`);
  console.log('');

  try {
    // 1. Verificar se o caminho existe
    console.log('1️⃣ VERIFICANDO CAMINHO...');
    const stats = await fs.stat(testPath);
    console.log(`   ✅ Caminho existe`);
    console.log(`   📊 isDirectory: ${stats.isDirectory()}`);
    console.log(`   📊 isFile: ${stats.isFile()}`);
    console.log(`   📊 size: ${stats.size}`);
    console.log(`   📊 modified: ${stats.mtime}`);
    console.log('');

    if (!stats.isDirectory()) {
      console.log('❌ ERRO: Caminho não é um diretório!');
      return;
    }

    // 2. Listar conteúdo do diretório
    console.log('2️⃣ LISTANDO CONTEÚDO DO DIRETÓRIO...');
    const entries = await fs.readdir(testPath, { withFileTypes: true });
    console.log(`   📋 Total de itens: ${entries.length}`);
    
    entries.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.name} (${entry.isDirectory() ? 'pasta' : 'arquivo'})`);
    });
    console.log('');

    // 3. Buscar imagens recursivamente
    console.log('3️⃣ BUSCANDO IMAGENS RECURSIVAMENTE...');
    const images = [];
    const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
    
    async function scanDirectory(dirPath, depth = 0) {
      const indent = '  '.repeat(depth);
      console.log(`${indent}🔍 Escaneando: ${dirPath}`);
      
      try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        console.log(`${indent}📋 Itens encontrados: ${items.length}`);
        
        for (const item of items) {
          const fullPath = path.join(dirPath, item.name);
          
          if (item.isDirectory()) {
            console.log(`${indent}📁 Pasta: ${item.name}`);
            await scanDirectory(fullPath, depth + 1);
          } else if (item.isFile()) {
            console.log(`${indent}📄 Arquivo: ${item.name}`);
            
            // Verificar se deve ser ignorado
            const shouldIgnore = shouldIgnoreFile(item.name);
            if (shouldIgnore) {
              console.log(`${indent}🚫 Ignorado: ${item.name}`);
              continue;
            }
            
            // Verificar extensão
            const ext = path.extname(item.name).toLowerCase();
            console.log(`${indent}🔍 Extensão: ${ext}`);
            
            if (extensions.includes(ext)) {
              console.log(`${indent}✅ Extensão válida: ${ext}`);
              try {
                const fileStats = await fs.stat(fullPath);
                images.push({
                  path: fullPath,
                  name: item.name,
                  size: fileStats.size,
                  modified: fileStats.mtime,
                  extension: ext
                });
                console.log(`${indent}✅ Imagem adicionada: ${item.name}`);
              } catch (statError) {
                console.log(`${indent}❌ Erro ao obter stats: ${statError.message}`);
              }
            } else {
              console.log(`${indent}❌ Extensão inválida: ${ext}`);
            }
          }
        }
      } catch (error) {
        console.log(`${indent}❌ Erro ao acessar diretório: ${error.message}`);
      }
    }
    
    await scanDirectory(testPath);
    
    // 4. Resultado final
    console.log('');
    console.log('4️⃣ RESULTADO FINAL:');
    console.log(`   📸 Total de imagens encontradas: ${images.length}`);
    
    if (images.length > 0) {
      console.log('   📸 Imagens encontradas:');
      images.forEach((img, index) => {
        console.log(`      ${index + 1}. ${img.name} (${img.extension}, ${img.size} bytes)`);
      });
    } else {
      console.log('   ⚠️  NENHUMA IMAGEM ENCONTRADA!');
      console.log('   🔍 Possíveis causas:');
      console.log('      - Caminho não contém imagens');
      console.log('      - Extensões não suportadas');
      console.log('      - Arquivos sendo ignorados');
      console.log('      - Problema de permissões');
    }
    
  } catch (error) {
    console.log('❌ ERRO GERAL:');
    console.log(`   Mensagem: ${error.message}`);
    console.log(`   Código: ${error.code}`);
    console.log(`   Stack: ${error.stack}`);
  }
  
  console.log('');
  console.log('🏁 DEBUG CONCLUÍDO!');
}

// Executar debug
const testPath = process.argv[2] || 'test-images';
debugSlideshowPath(testPath).catch(console.error);
