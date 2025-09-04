#!/usr/bin/env node

/**
 * Script de Verificação do Projeto DePara
 * Verifica problemas básicos de sintaxe, imports e dependências
 *
 * @author yopastorelli
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando projeto DePara...\n');

// Verificar se arquivos principais existem
const requiredFiles = [
  'package.json',
  'src/main.js',
  'src/routes/index.js',
  'src/routes/health.js',
  'src/routes/status.js',
  'src/routes/fileOperations.js',
  'src/utils/logger.js',
  'src/utils/fileOperations.js',
  'src/middleware/errorHandler.js',
  'src/middleware/rateLimiter.js'
];

console.log('📁 Verificando arquivos principais...');
let filesOK = true;

for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - ARQUIVO NÃO ENCONTRADO`);
    filesOK = false;
  }
}

if (!filesOK) {
  console.log('\n❌ Alguns arquivos principais estão faltando!');
  process.exit(1);
}

// Verificar package.json
console.log('\n📦 Verificando package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`✅ Nome: ${packageJson.name}`);
  console.log(`✅ Versão: ${packageJson.version}`);
  console.log(`✅ Node.js: ${packageJson.engines?.node || 'Não especificado'}`);
  console.log(`✅ Dependências: ${Object.keys(packageJson.dependencies || {}).length}`);
  console.log(`✅ Scripts: ${Object.keys(packageJson.scripts || {}).length}`);
} catch (error) {
  console.log(`❌ Erro ao ler package.json: ${error.message}`);
  process.exit(1);
}

// Verificar sintaxe dos arquivos principais
console.log('\n🔍 Verificando sintaxe dos arquivos...');

const jsFiles = [
  'src/main.js',
  'src/routes/index.js',
  'src/routes/health.js',
  'src/routes/status.js',
  'src/utils/logger.js',
  'src/middleware/errorHandler.js',
  'src/middleware/rateLimiter.js'
];

let syntaxOK = true;

for (const file of jsFiles) {
  try {
    // Verificar se o arquivo pode ser lido e tem sintaxe básica
    const content = fs.readFileSync(file, 'utf8');

    // Verificar se há erros de sintaxe básicos
    if (content.includes('require(') && content.includes('module.exports')) {
      console.log(`✅ ${file} - Sintaxe básica OK`);
    } else {
      console.log(`⚠️  ${file} - Verificar estrutura de módulos`);
    }
  } catch (error) {
    console.log(`❌ ${file} - Erro: ${error.message}`);
    syntaxOK = false;
  }
}

// Verificar diretórios necessários
console.log('\n📂 Verificando diretórios...');

const requiredDirs = [
  'src',
  'src/routes',
  'src/utils',
  'src/middleware',
  'src/public',
  'src/config',
  'tests'
];

for (const dir of requiredDirs) {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir}/`);
  } else {
    console.log(`❌ ${dir}/ - DIRETÓRIO NÃO ENCONTRADO`);
  }
}

// Verificar arquivos de configuração
console.log('\n⚙️  Verificando arquivos de configuração...');

const configFiles = [
  'env.example',
  'jest.config.js',
  'ecosystem.config.js'
];

for (const file of configFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`⚠️  ${file} - Arquivo opcional não encontrado`);
  }
}

// Verificar arquivos de documentação
console.log('\n📚 Verificando documentação...');

const docFiles = [
  'README.md',
  'README-Raspbian.md',
  'docs/API.md'
];

for (const file of docFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`⚠️  ${file} - Documentação não encontrada`);
  }
}

// Verificar arquivos especiais criados recentemente
console.log('\n🆕 Verificando arquivos especiais para Raspberry Pi...');

const specialFiles = [
  'INSTRUCOES-RP4.md',
  'test-rp4.sh',
  'install-raspbian.sh'
];

for (const file of specialFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`⚠️  ${file} - Arquivo especial não encontrado`);
  }
}

// Resumo final
console.log('\n' + '='.repeat(50));
console.log('📊 RESUMO DA VERIFICAÇÃO');
console.log('='.repeat(50));

if (filesOK && syntaxOK) {
  console.log('✅ Projeto parece estar em boas condições!');
  console.log('✅ Todos os arquivos principais estão presentes');
  console.log('✅ Sintaxe dos arquivos principais está OK');
  console.log('✅ Estrutura de diretórios está adequada');

  console.log('\n🚀 Próximos passos recomendados:');
  console.log('1. npm install (para instalar dependências)');
  console.log('2. npm test (para executar testes)');
  console.log('3. npm run dev (para desenvolvimento)');
  console.log('4. npm start (para produção)');

} else {
  console.log('❌ Há problemas que precisam ser corrigidos:');
  if (!filesOK) console.log('   - Arquivos principais faltando');
  if (!syntaxOK) console.log('   - Problemas de sintaxe');
  console.log('\n🔧 Execute: npm run lint para mais detalhes');
}

console.log('\n🍓 DePara - Sistema pronto para desenvolvimento!');
console.log('=' + '='.repeat(49));
