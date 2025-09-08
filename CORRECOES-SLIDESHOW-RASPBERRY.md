# 🍓 Correções do Slideshow para Raspberry Pi

## ✅ Problemas Identificados e Corrigidos

### 1. **Rate Limiting Muito Restritivo**
- **Problema**: API retornava `429 Too Many Requests`
- **Causa**: `readRateLimiter` limitava a 60 requisições/minuto
- **Solução**: 
  - Aumentado para 200 requisições/minuto
  - Criado `slideshowRateLimiter` específico com 500 requisições/minuto
  - Aplicado na rota `POST /api/files/list-images`

### 2. **Chamada Incorreta da Função shouldIgnoreFile**
- **Problema**: Função esperava apenas `fileName`, mas recebia `currentPath, item`
- **Causa**: Erro na chamada em `listImagesRecursive`
- **Solução**: Corrigido para `shouldIgnoreFile(item)`

## 🚀 Como Aplicar no Raspberry Pi

### 1. **Atualizar o Código**
```bash
cd /caminho/para/DePara
git pull origin main
```

### 2. **Reiniciar o Serviço**
```bash
sudo systemctl restart depara
```

### 3. **Verificar se Está Funcionando**
```bash
# Verificar status do serviço
sudo systemctl status depara

# Verificar logs em tempo real
sudo journalctl -u depara -f

# Ou usar o script de monitoramento
./monitor-logs.ps1
```

### 4. **Testar a API**
```bash
# Usar o script de teste
./test-raspberry-slideshow.ps1

# Ou testar manualmente
curl -X POST http://localhost:3000/api/files/list-images \
  -H "Content-Type: application/json" \
  -d '{"folderPath": "/caminho/para/suas/imagens", "extensions": [".jpg", ".jpeg", ".png", ".gif", ".bmp"], "recursive": true}'
```

## 🔍 Scripts de Debug Disponíveis

### 1. **debug-slideshow-complete.js**
- Testa a busca de imagens localmente
- Mostra logs detalhados do processo
- Identifica problemas de permissão ou caminho

### 2. **test-raspberry-slideshow.ps1**
- Testa a API diretamente no Raspberry Pi
- Simula exatamente o que o frontend faz
- Mostra resposta da API

### 3. **monitor-logs.ps1**
- Monitora logs do servidor em tempo real
- Filtra apenas logs relacionados ao slideshow
- Ajuda a identificar problemas em tempo real

## 📋 Checklist de Verificação

- [ ] Código atualizado (`git pull origin main`)
- [ ] Serviço reiniciado (`sudo systemctl restart depara`)
- [ ] Serviço rodando (`sudo systemctl status depara`)
- [ ] API respondendo (`curl http://localhost:3000/api/health`)
- [ ] Slideshow testado com pasta real
- [ ] Logs verificados para erros

## 🎯 Resultado Esperado

Após aplicar as correções:
- ✅ Rate limiting não bloqueia mais o slideshow
- ✅ Busca recursiva encontra imagens nas subpastas
- ✅ Slideshow carrega e exibe imagens corretamente
- ✅ Logs mostram processo de busca detalhado

## 🆘 Se Ainda Não Funcionar

1. **Verificar logs detalhados**:
   ```bash
   sudo journalctl -u depara -f | grep -i "slideshow\|imagem\|image"
   ```

2. **Testar caminho manualmente**:
   ```bash
   ls -la "/caminho/para/suas/imagens"
   ```

3. **Verificar permissões**:
   ```bash
   sudo chown -R depara:depara "/caminho/para/suas/imagens"
   sudo chmod -R 755 "/caminho/para/suas/imagens"
   ```

4. **Usar script de debug**:
   ```bash
   node debug-slideshow-complete.js "/caminho/para/suas/imagens"
   ```
