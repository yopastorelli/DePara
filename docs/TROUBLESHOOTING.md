# Guia de Troubleshooting - DePara

## 🚨 Problemas Comuns e Soluções

### 1. Aplicação não inicia

#### Sintomas
- Erro ao executar `npm start`
- Aplicação não responde na porta 3000
- Mensagens de erro no console

#### Soluções

**Verificar dependências:**
```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

**Verificar porta:**
```bash
# Verificar se porta está em uso
netstat -tulpn | grep :3000
lsof -i :3000

# Matar processo usando a porta
kill -9 [PID]
```

**Verificar logs:**
```bash
# Ver logs da aplicação
npm run logs

# Ver logs do sistema (Raspberry Pi)
sudo journalctl -u depara -f
```

**Verificar permissões:**
```bash
# Corrigir permissões
sudo chown -R $USER:$USER /caminho/do/projeto
chmod -R 755 /caminho/do/projeto
```

### 2. Erro de permissão

#### Sintomas
- Erro `EACCES` ou `EPERM`
- Operações de arquivo falham
- Mensagens de "permission denied"

#### Soluções

**Linux/macOS:**
```bash
# Corrigir permissões do projeto
sudo chown -R $USER:$USER /caminho/do/projeto
chmod -R 755 /caminho/do/projeto

# Corrigir permissões de pastas específicas
sudo chmod 755 /caminho/para/backups
sudo chmod 755 /caminho/para/logs
```

**Raspberry Pi:**
```bash
# Usar sudo para operações críticas
sudo chmod -R 755 /caminho/do/projeto

# Verificar usuário atual
whoami

# Verificar permissões
ls -la /caminho/do/projeto
```

**Windows:**
```cmd
# Executar como administrador
# Verificar se pasta não está em uso
# Verificar antivírus
```

### 3. Slideshow não carrega imagens

#### Sintomas
- Tela preta no slideshow
- Mensagem "Nenhuma imagem encontrada"
- Erro 404 ao carregar imagens

#### Soluções

**Verificar pasta de imagens:**
```bash
# Verificar se pasta existe
ls -la /caminho/para/imagens

# Verificar permissões
ls -la /caminho/para/imagens

# Corrigir permissões
chmod 755 /caminho/para/imagens
```

**Verificar extensões:**
```bash
# Verificar tipos de arquivo na pasta
find /caminho/para/imagens -type f -name "*.jpg" | head -5
find /caminho/para/imagens -type f -name "*.png" | head -5
```

**Verificar logs da API:**
```bash
# Ver logs específicos do slideshow
grep "slideshow" logs/app.log
grep "list-images" logs/app.log
```

**Testar API diretamente:**
```bash
# Testar endpoint de listagem
curl -X POST http://localhost:3000/api/files/list-images \
  -H "Content-Type: application/json" \
  -d '{
    "folderPath": "/caminho/para/imagens",
    "extensions": ["jpg", "png"],
    "recursive": true
  }'
```

### 4. Botões HIDE/DELETE não funcionam

#### Sintomas
- Botões não respondem ao clique
- Erro 500 na API
- Mensagem "Erro ao ocultar/apagar imagem"

#### Soluções

**Verificar configuração de pastas:**
```bash
# Verificar se pastas de destino existem
ls -la /caminho/para/ocultas
ls -la /caminho/para/excluidas

# Criar pastas se não existirem
mkdir -p /caminho/para/ocultas
mkdir -p /caminho/para/excluidas
```

**Verificar permissões de escrita:**
```bash
# Testar escrita nas pastas
touch /caminho/para/ocultas/teste.txt
touch /caminho/para/excluidas/teste.txt

# Corrigir permissões
chmod 755 /caminho/para/ocultas
chmod 755 /caminho/para/excluidas
```

**Verificar logs da API:**
```bash
# Ver logs de erro
grep "ERROR" logs/app.log
grep "500" logs/app.log
```

**Testar API diretamente:**
```bash
# Testar operação de mover
curl -X POST http://localhost:3000/api/files/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "move",
    "sourcePath": "/caminho/arquivo.jpg",
    "targetPath": "/caminho/ocultas/arquivo.jpg"
  }'
```

### 5. Performance lenta

#### Sintomas
- Aplicação demora para responder
- Slideshow com delay
- Interface travando

#### Soluções

**Verificar recursos do sistema:**
```bash
# Verificar uso de CPU e memória
top
htop

# Verificar espaço em disco
df -h

# Verificar processos Node.js
ps aux | grep node
```

**Otimizar configurações:**
```bash
# Reduzir nível de log
echo "LOG_LEVEL=warn" >> .env

# Aumentar intervalo do slideshow
echo "SLIDESHOW_DEFAULT_INTERVAL=60000" >> .env
```

**Limpar cache e logs:**
```bash
# Limpar logs antigos
find logs/ -name "*.log" -mtime +7 -delete

# Limpar cache do Node.js
rm -rf node_modules/.cache
```

### 6. Erro de conexão

#### Sintomas
- "Connection refused"
- Timeout na API
- Interface não carrega

#### Soluções

**Verificar se aplicação está rodando:**
```bash
# Verificar processo
ps aux | grep node

# Verificar porta
netstat -tulpn | grep :3000
```

**Verificar firewall:**
```bash
# Linux - verificar UFW
sudo ufw status

# Permitir porta 3000
sudo ufw allow 3000
```

**Verificar configuração de rede:**
```bash
# Testar conectividade local
curl http://localhost:3000/api/health

# Testar de outro dispositivo
curl http://[IP_DO_SERVIDOR]:3000/api/health
```

### 7. Problemas específicos do Raspberry Pi

#### Sintomas
- Aplicação não inicia no Raspberry Pi
- Erro de permissão específico
- Performance muito lenta

#### Soluções

**Verificar versão do Node.js:**
```bash
# Verificar versão
node --version

# Instalar Node.js 16+ se necessário
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Configurar como serviço:**
```bash
# Copiar arquivo de serviço
sudo cp depara.service /etc/systemd/system/

# Recarregar systemd
sudo systemctl daemon-reload

# Habilitar e iniciar
sudo systemctl enable depara
sudo systemctl start depara
```

**Otimizar para Raspberry Pi:**
```bash
# Configurações específicas
echo "NODE_ENV=production" >> .env
echo "LOG_LEVEL=warn" >> .env
echo "SLIDESHOW_DEFAULT_INTERVAL=60000" >> .env
```

### 8. Problemas de backup

#### Sintomas
- Backup não é criado
- Erro ao criar backup
- Pasta de backup não existe

#### Soluções

**Verificar pasta de backup:**
```bash
# Verificar se pasta existe
ls -la backups/

# Criar pasta se não existir
mkdir -p backups
chmod 755 backups
```

**Verificar permissões:**
```bash
# Testar criação de arquivo
touch backups/teste.txt

# Corrigir permissões
chmod 755 backups
```

**Verificar configuração:**
```bash
# Verificar variáveis de ambiente
grep BACKUP .env

# Configurar pasta de backup
echo "BACKUP_FOLDER=./backups" >> .env
```

## 🔍 Diagnóstico Avançado

### Verificar logs detalhados

```bash
# Ver todos os logs
tail -f logs/app.log

# Filtrar por nível
grep "ERROR" logs/app.log
grep "WARN" logs/app.log

# Filtrar por funcionalidade
grep "slideshow" logs/app.log
grep "api" logs/app.log
```

### Testar componentes individualmente

```bash
# Testar API de saúde
curl http://localhost:3000/api/health

# Testar API de arquivos
curl -X POST http://localhost:3000/api/files/execute \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}'

# Testar API de slideshow
curl -X POST http://localhost:3000/api/files/list-images \
  -H "Content-Type: application/json" \
  -d '{"folderPath": "/tmp"}'
```

### Verificar configuração

```bash
# Verificar arquivo .env
cat .env

# Verificar package.json
cat package.json

# Verificar permissões
ls -la
```

## 📞 Suporte Adicional

### Coletar informações para suporte

```bash
# Script para coletar informações
cat > collect-info.sh << 'EOF'
#!/bin/bash
echo "=== Informações do Sistema ==="
uname -a
node --version
npm --version

echo "=== Status da Aplicação ==="
ps aux | grep node
netstat -tulpn | grep :3000

echo "=== Logs Recentes ==="
tail -20 logs/app.log

echo "=== Configuração ==="
cat .env
EOF

chmod +x collect-info.sh
./collect-info.sh
```

### Contato

Se os problemas persistirem:

1. **Coletar informações** usando o script acima
2. **Verificar issues** no GitHub
3. **Abrir nova issue** com informações coletadas
4. **Incluir logs** relevantes
5. **Descrever passos** para reproduzir o problema

---

**DePara** - Resolvendo problemas com eficiência! 🚀
