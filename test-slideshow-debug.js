#!/usr/bin/env node

/**
 * Script de debug para testar a busca de imagens do slideshow
 * Executa a mesma lógica da API para identificar problemas
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

async function listImagesRecursively(dirPath, imageList = [], depth = 0) {
  console.log(`🔍 [${depth}] Escaneando diretório: ${dirPath}`);
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    console.log(`📋 [${depth}] Itens encontrados: ${entries.length}`);
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      console.log(`📄 [${depth}] Processando: ${entry.name} (${entry.isDirectory() ? 'pasta' : 'arquivo'})`);
      
      if (entry.isDirectory()) {
        // Recursão para subdiretórios
        await listImagesRecursively(fullPath, imageList, depth + 1);
      } else if (entry.isFile()) {
        // Verificar se arquivo deve ser ignorado
        const shouldIgnore = shouldIgnoreFile(entry.name);
        if (shouldIgnore) {
          console.log(`🚫 [${depth}] Arquivo ignorado: ${entry.name}`);
          continue;
        }
        
        // Verificar se é uma imagem
        const ext = path.extname(entry.name).toLowerCase();
        console.log(`📄 [${depth}] Arquivo: ${entry.name} (ext: ${ext})`);
        
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
        if (validExtensions.includes(ext)) {
          console.log(`✅ [${depth}] Extensão válida: ${ext}`);
          try {
            const stats = await fs.stat(fullPath);
            imageList.push({
              path: fullPath,
              name: entry.name,
              size: stats.size,
              modified: stats.mtime,
              extension: ext
            });
            console.log(`✅ [${depth}] Imagem adicionada: ${entry.name}`);
          } catch (statError) {
            console.log(`❌ [${depth}] Erro ao obter stats de ${entry.name}: ${statError.message}`);
          }
        } else {
          console.log(`❌ [${depth}] Extensão inválida: ${ext} (esperado: ${validExtensions.join(', ')})`);
        }
      }
    }
  } catch (error) {
    console.log(`❌ [${depth}] Erro ao acessar diretório ${dirPath}: ${error.message}`);
  }
  
  return imageList;
}

async function testSlideshowPath() {
  const testPath = process.argv[2] || '/mnt/lytspot/@SYNC@/_@@PICZ & VIDEOS LYT @@_/_@LYT PicZ por ANO@_/@Bfore 2001@';
  
  console.log('🚀 Iniciando teste de busca de imagens...');
  console.log(`📁 Caminho de teste: ${testPath}`);
  console.log('=' .repeat(80));
  
  try {
    // Verificar se o caminho existe
    const stats = await fs.stat(testPath);
    console.log(`📊 Estatísticas do caminho:`);
    console.log(`   - isDirectory: ${stats.isDirectory()}`);
    console.log(`   - isFile: ${stats.isFile()}`);
    console.log(`   - size: ${stats.size}`);
    console.log(`   - modified: ${stats.mtime}`);
    console.log('=' .repeat(80));
    
    if (!stats.isDirectory()) {
      console.log('❌ Caminho não é um diretório!');
      return;
    }
    
    // Listar imagens recursivamente
    const images = await listImagesRecursively(testPath);
    
    console.log('=' .repeat(80));
    console.log(`📸 RESULTADO FINAL:`);
    console.log(`   - Total de imagens encontradas: ${images.length}`);
    
    if (images.length > 0) {
      console.log(`   - Primeiras 5 imagens:`);
      images.slice(0, 5).forEach((img, index) => {
        console.log(`     ${index + 1}. ${img.name} (${img.extension}, ${img.size} bytes)`);
      });
    } else {
      console.log(`   - Nenhuma imagem encontrada!`);
    }
    
  } catch (error) {
    console.log(`❌ Erro geral: ${error.message}`);
  }
}

// Executar teste
testSlideshowPath().catch(console.error);
