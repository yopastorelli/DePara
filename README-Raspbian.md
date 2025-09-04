# 🍓 DePara no Raspbian/Raspberry Pi

## 📋 Visão Geral

Este guia explica como instalar e executar o **DePara** no sistema operacional **Raspbian** (baseado em Debian) para **Raspberry Pi**.

## 🚀 Instalação Rápida

### **Opção 1: Instalação Automatizada (Recomendada para Raspberry Pi 4)**

```bash
# 1. Clonar o repositório (se ainda não clonado)
git clone https://github.com/yopastorelli/DePara.git
cd DePara

# 2. Executar script de instalação otimizado
chmod +x install-raspbian.sh
./install-raspbian.sh
```

### **Opção 2: Instalação Manual (Passo a Passo)**

```bash
# 1. Atualizar sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar dependências
sudo apt install -y curl wget git build-essential python3 python3-pip

# 3. Instalar Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Verificar instalação
node --version  # Deve ser v18.x.x
npm --version   # Deve ser 8.x.x ou superior

# 5. Clonar e instalar DePara
git clone https://github.com/yopastorelli/DePara.git
cd DePara
npm install

# 6. Configurar ambiente
cp env.example .env
```

## 🔧 Configurações Específicas para Raspberry Pi

### **Otimizações de Memória**

O Raspbian pode ter limitações de memória. Ajuste o arquivo `.env`:

```bash
# Configurações otimizadas para Raspberry Pi
NODE_ENV=production
LOG_LEVEL=warn  # Reduz logs para economizar memória
PORT=3000
```

### **Configuração de Swap (Recomendado)**

```bash
# Verificar swap atual
free -h

# Criar arquivo de swap se necessário
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Tornar permanente
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### **Configuração de Firewall**

```bash
# Liberar porta da aplicação
sudo ufw allow 3000/tcp
sudo ufw enable
```

## 🚀 Execução no Raspberry Pi 4

### **🔧 Configurações Otimizadas (Após Correções Recentes)**

O sistema foi otimizado com as seguintes melhorias implementadas:

- ✅ **CSP Compliance**: Removidos event handlers inline
- ✅ **Sistema de Logging Estruturado**: Logs com emojis e metadados
- ✅ **Controle de Carregamento**: Debouncing para evitar chamadas duplicadas
- ✅ **Validação Visual**: Feedback em tempo real nos campos
- ✅ **Performance Otimizada**: Controle de memória e recursos

### **Modo Desenvolvimento (Recomendado para Testes)**

```bash
# No diretório do projeto
cd DePara

# Executar em modo desenvolvimento
npm run dev
```

### **Modo Produção (Otimizado para RP4)**

```bash
# Configurar arquivo de ambiente otimizado
cp env.example .env

# Executar em produção
npm start
```

### **Execução como Serviço (Background)**

```bash
# Configurar como serviço do sistema
sudo systemctl enable depara
sudo systemctl start depara

# Verificar status
sudo systemctl status depara

# Ver logs em tempo real
sudo journalctl -u depara -f
```

## 🧪 Teste no Raspberry Pi 4

### **Teste Básico de Funcionalidade**

```bash
# 1. Verificar se aplicação está rodando
curl http://localhost:3000/health

# 2. Verificar logs da aplicação
tail -f logs/app.log

# 3. Testar interface web
# Abrir navegador em: http://[IP_DO_RASPBERRY_PI]:3000

# 4. Testar operações básicas
# - Criar pastas de teste
mkdir -p ~/depara/input ~/depara/output
echo "teste de arquivo" > ~/depara/input/teste.txt

# - Testar operação via interface web
```

### **Teste de Performance**

```bash
# Verificar uso de recursos durante operação
htop &

# Monitorar temperatura do CPU
watch -n 1 vcgencmd measure_temp

# Verificar logs de performance
tail -f logs/app.log | grep -E "(PERFORMANCE|SUCCESS|ERROR)"
```

## 📊 Monitoramento de Recursos

### **Comandos Úteis**

```bash
# Uso de memória
free -h

# Uso de CPU
htop

# Uso de disco
df -h

# Temperatura (Raspberry Pi)
vcgencmd measure_temp

# Logs da aplicação
tail -f logs/app.log

# Status do serviço
sudo systemctl status depara
```

### **Alertas de Recursos**

O script de instalação configura alertas automáticos para:
- **Memória baixa** (< 100MB disponível)
- **CPU sobrecarregado** (load average > 2.0)
- **Temperatura alta** (se disponível)

## 🔍 Solução de Problemas

### **Problema: Falha na instalação de dependências**

```bash
# Limpar cache npm
npm cache clean --force

# Reinstalar com --force
npm install --force

# Verificar versão do Node.js
node --version  # Deve ser >= 16.0.0
```

### **Problema: Aplicação não inicia**

```bash
# Verificar logs
tail -f logs/app.log

# Verificar porta
sudo netstat -tlnp | grep :3000

# Verificar permissões
ls -la logs/
ls -la .env
```

### **Problema: Baixo desempenho**

```bash
# Verificar uso de recursos
htop
free -h
df -h

# Ajustar configurações
nano .env
# LOG_LEVEL=warn
# NODE_ENV=production
```

### **Problema: Falha de conectividade**

```bash
# Verificar firewall
sudo ufw status

# Verificar rede
ip addr show
ping google.com

# Testar porta localmente
curl http://localhost:3000/health
```

## 📱 Acesso Remoto

### **Via IP Local**

```bash
# Descobrir IP do Raspberry Pi
hostname -I

# Acessar de outro dispositivo na rede
http://[IP_DO_RASPBERRY_PI]:3000
```

### **Via SSH (se configurado)**

```bash
# Conectar via SSH
ssh pi@[IP_DO_RASPBERRY_PI]

# Navegar para o diretório
cd DePara

# Verificar status
sudo systemctl status depara
```

## 🔒 Segurança

### **Recomendações**

1. **Alterar senha padrão** do usuário `pi`
2. **Configurar firewall** (ufw)
3. **Usar HTTPS** em produção
4. **Manter sistema atualizado**
5. **Monitorar logs** regularmente

### **Configuração de Firewall Avançada**

```bash
# Configurar regras específicas
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 3000/tcp
sudo ufw enable
```

## 📈 Performance e Otimizações

### **Para Raspberry Pi 4 (4GB)**

- **Memória**: Aplicação usa ~50-100MB
- **CPU**: Baixo uso em operações normais
- **Rede**: Suporta múltiplas conexões simultâneas

### **Para Raspberry Pi 3 ou menor**

- **Memória**: Considere aumentar swap
- **CPU**: Pode ser necessário limitar operações concorrentes
- **Rede**: Limite conexões simultâneas

### **Configurações de Otimização**

```bash
# Ajustar arquivo .env para Raspberry Pi menor
NODE_ENV=production
LOG_LEVEL=error  # Apenas erros
PORT=3000

# Limitar operações concorrentes (se necessário)
# Implementar rate limiting na aplicação
```

## 🆘 Suporte

### **Logs Importantes**

```bash
# Logs da aplicação
tail -f logs/app.log

# Logs do sistema
sudo journalctl -u depara -f

# Logs do sistema geral
sudo tail -f /var/log/syslog
```

### **Comandos de Diagnóstico**

```bash
# Status geral do sistema
sudo systemctl status depara
sudo systemctl status networking
sudo systemctl status ssh

# Verificar recursos
free -h
df -h
vcgencmd measure_temp

# Testar conectividade
curl -I http://localhost:3000/health
```

## 🔄 Atualizações

### **Atualizar Aplicação**

```bash
cd DePara
git pull origin main
npm install
sudo systemctl restart depara
```

### **Atualizar Sistema**

```bash
sudo apt update && sudo apt upgrade -y
sudo apt autoremove -y
sudo reboot
```

---

## 📋 Checklist de Instalação para Raspberry Pi 4

### **Pré-requisitos**
- [ ] Raspberry Pi 4 com Raspbian OS atualizado
- [ ] Conexão à internet
- [ ] Pelo menos 1GB de espaço livre em disco

### **Instalação**
- [ ] Sistema Raspbian atualizado (`sudo apt update && sudo apt upgrade -y`)
- [ ] Node.js 18.x instalado (versão otimizada para RP4)
- [ ] Dependências do sistema instaladas
- [ ] Repositório DePara clonado ou transferido
- [ ] Dependências npm instaladas (`npm install`)
- [ ] Arquivo .env configurado (copiado de env.example)
- [ ] Diretórios de logs e backups criados

### **Configuração**
- [ ] Permissões configuradas corretamente
- [ ] Porta 3000 liberada no firewall (opcional)
- [ ] Serviço systemd criado e configurado (opcional)

### **Teste Final**
- [ ] Aplicação inicializada com sucesso
- [ ] Interface web acessível em `http://[IP_DO_RP4]:3000`
- [ ] Operações básicas funcionando (mover/copiar/apagar)
- [ ] Logs estruturados sendo gerados corretamente
- [ ] Validação visual funcionando nos campos

### **Comandos de Verificação Rápida**

```bash
# Status completo do sistema
echo "=== STATUS DO SISTEMA ==="
echo "IP do Raspberry Pi:"
hostname -I
echo ""
echo "Status da aplicação:"
sudo systemctl status depara 2>/dev/null || echo "Serviço não configurado"
echo ""
echo "Uso de recursos:"
free -h | grep "Mem:"
echo ""
echo "Aplicação rodando:"
curl -s http://localhost:3000/health | head -5 || echo "Aplicação não responde"
echo ""
echo "Logs recentes:"
tail -5 logs/app.log 2>/dev/null || echo "Arquivo de log não encontrado"
```

---

## 🚀 **Instruções Rápidas para Teste**

```bash
# 1. Transferir arquivos para o Raspberry Pi
# (usar scp, rsync ou cartão SD)

# 2. Executar instalação
cd DePara
chmod +x install-raspbian.sh
./install-raspbian.sh

# 3. Iniciar aplicação
npm start

# 4. Testar no navegador
# http://[IP_DO_RASPBERRY_PI]:3000

# 5. Verificar logs
tail -f logs/app.log
```

---

**🍓 DePara no Raspberry Pi 4** - Sistema totalmente otimizado com correções implementadas! 🚀
