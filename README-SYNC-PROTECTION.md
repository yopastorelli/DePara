# 🛡️ Proteção de Arquivos Sincronizados

## 📋 Visão Geral

O DePara possui um **sistema inteligente de proteção** que automaticamente identifica e ignora arquivos críticos para o funcionamento da sincronização e do sistema operacional. Isso garante que suas pastas sincronizadas continuem funcionando perfeitamente.

## 🔄 Compatibilidade com Resilio Sync

### Arquivos Automaticamente Protegidos

#### 📁 Diretórios de Configuração
- `.sync/` - Diretório principal de configuração da sincronização
- `.sync/Archive/` - Arquivos arquivados
- `.sync/Streams/` - Streams de sincronização

#### 📄 Arquivos Temporários
- `.!sync` - Arquivos temporários de sincronização
- `*.!sync` - Arquivos com extensão temporária
- `.rsls` - Arquivos de lista de sincronização

#### ⚙️ Arquivos de Configuração
- `.syncignore` - Lista de arquivos ignorados
- `.bts` - Arquivos BitTorrent Sync (legacy)
- `*.sync` - Arquivos de configuração

## 💻 Arquivos de Sistema Protegidos

### Windows
- `Thumbs.db` - Miniaturas de imagens
- `desktop.ini` - Configurações de pasta
- `$RECYCLE.BIN/` - Lixeira
- `System Volume Information/` - Sistema

### macOS
- `.DS_Store` - Configurações de pasta
- `._*` - Arquivos de recurso
- `.Spotlight-*` - Índice Spotlight
- `.fseventsd/` - Eventos do sistema

### Linux
- `.directory` - Configurações KDE
- `.Trash-*` - Lixeira
- Arquivos NFS (`4913`, `.nfs*`)

## ⏰ Arquivos Temporários Protegidos

### Desenvolvimento
- `__pycache__/` - Cache Python
- `node_modules/` - Dependências Node.js
- `.git/` - Repositório Git
- `.vscode/` - Configurações VS Code

### Sistema
- `*.tmp`, `*.temp` - Arquivos temporários
- `*.bak`, `*.backup` - Backups
- `*.log` - Arquivos de log
- `*.lock`, `*.lck` - Arquivos de bloqueio

## 🔍 Como Verificar Proteção

### Via Interface Web
1. Acesse `http://localhost:3000/ui`
2. Vá para "Operações de Arquivos"
3. Clique em "Ver Arquivos Ignorados"
4. Use o teste interativo para verificar arquivos específicos

### Via API
```bash
# Verificar se arquivo seria ignorado
curl -X POST http://localhost:3000/api/files/check-ignore \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/sync/.sync/Archive",
    "filename": "Archive"
  }'

# Listar todos os padrões protegidos
curl http://localhost:3000/api/files/ignored-patterns
```

## ✅ Benefícios da Proteção

### 🔄 Preserva Sincronização
- Não interrompe o processo de sincronização
- Mantém integridade dos arquivos sincronizados
- Evita conflitos de sincronização

### 🛡️ Evita Problemas de Sistema
- Não move arquivos críticos do sistema
- Preserva configurações de pastas
- Evita corromper índices e caches

### ⚡ Otimiza Performance
- Não processa arquivos desnecessários
- Reduz tempo de operações em lote
- Economiza recursos do sistema

### 🔧 Garante Compatibilidade
- Funciona em Windows, Linux e macOS
- Compatível com diferentes ferramentas
- Segue padrões do sistema operacional

## 📝 Arquivo .syncignore

Para o Resilio Sync, você pode criar um arquivo `.syncignore` na raiz da pasta sincronizada:

```bash
# Arquivo .syncignore
# Arquivos que o Resilio Sync deve ignorar

# Arquivos de sistema
Thumbs.db
.DS_Store
desktop.ini

# Arquivos temporários
*.tmp
*.temp
*.bak
*.log

# Caches
__pycache__/
node_modules/
.cache/

# Backups do DePara
backups/
logs/
```

## 🚨 Cenários Comuns

### ✅ Operações Seguras
```bash
# ✅ Seguro - move apenas arquivos de dados
POST /api/files/execute
{
  "action": "move",
  "sourcePath": "/sync/pasta_com_dados",
  "targetPath": "/backup/dados",
  "options": {
    "batch": true,
    "preserveStructure": true
  }
}
```

### ❌ Operações que Seriam Bloqueadas
```bash
# ❌ BLOQUEADO - tenta mover arquivo crítico
POST /api/files/execute
{
  "action": "move",
  "sourcePath": "/sync/.sync/Archive",
  "targetPath": "/backup/sync"
}
# Resultado: Arquivo automaticamente ignorado
```

## 📊 Monitoramento de Proteção

### Logs de Proteção
```
[INFO] Arquivo ignorado (resilioSync): /sync/.sync/Archive
[INFO] Arquivo ignorado (systemFiles): /sync/Thumbs.db
[INFO] Arquivo ignorado (tempFiles): /sync/temp.log
```

### Dashboard de Estatísticas
- Arquivos processados: 1,247
- Arquivos ignorados: 89 (protegidos)
- Taxa de proteção: 6.7%

## 🔧 Configuração Avançada

### Adicionar Padrões Personalizados
```javascript
// No arquivo src/utils/fileOperations.js
customPatterns: [
    'meu_arquivo_importante.*',
    '*.min.js',
    'config.local.*'
]
```

### Verificação Manual
```javascript
// Verificar arquivo específico
const shouldIgnore = fileOperationsManager.shouldIgnoreFile(
    '/caminho/completo/arquivo.ext',
    'arquivo.ext'
);
```

## 🎯 Recomendações

### Para Pastas Sincronizadas
1. ✅ **Sempre use a opção "preserveStructure"**
2. ✅ **Monitore os logs** para ver arquivos ignorados
3. ✅ **Teste operações** em pastas pequenas primeiro
4. ✅ **Verifique proteção** antes de operações em lote

### Para Desenvolvimento
1. ✅ **Configure .syncignore** adequadamente
2. ✅ **Use templates** de limpeza para arquivos temporários
3. ✅ **Monitore backups** regularmente
4. ✅ **Teste restauração** periodicamente

## 🆘 Solução de Problemas

### Arquivo Está Sendo Ignorado Inesperadamente
```bash
# Verifique se está na lista de padrões
curl http://localhost:3000/api/files/ignored-patterns

# Teste arquivo específico
curl -X POST http://localhost:3000/api/files/check-ignore \
  -H "Content-Type: application/json" \
  -d '{"filename": "arquivo.ext"}'
```

### Pasta de Sincronização Parou de Funcionar
1. ✅ Verifique se arquivos `.sync/` ainda existem
2. ✅ Confirme que não foram movidos por engano
3. ✅ Reinicie o serviço de sincronização
4. ✅ Verifique logs do Resilio Sync

## 📞 Suporte

Se encontrar problemas com a proteção de arquivos:
1. Verifique os logs da aplicação
2. Use a ferramenta de teste na interface web
3. Consulte a documentação da API
4. Abra uma issue no repositório

---

**🎉 Com o sistema de proteção inteligente, suas pastas sincronizadas estão sempre seguras!**

