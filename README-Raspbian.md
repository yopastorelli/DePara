# 🍓 DePara no Raspbian/Raspberry Pi

## 📋 Visão Geral

Este guia explica como instalar e executar o **DePara** no sistema operacional **Raspbian** (baseado em Debian) para **Raspberry Pi**.

## 🚀 Instalação Rápida

### **Opção 1: Instalação Automatizada (Recomendada)**

```bash
# 1. Clonar o repositório
git clone https://github.com/yopastorelli/DePara.git
cd DePara

# 2. Executar script de instalação
chmod +x install-raspbian.sh
./install-raspbian.sh
```

### **Opção 2: Instalação Manual**

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

## 🚀 Execução

### **Modo Desenvolvimento**

```bash
npm run dev
```

### **Modo Produção**

```bash
npm start
```

### **Como Serviço Systemd (Recomendado para Produção)**

```bash
# Habilitar serviço
sudo systemctl enable depara

# Iniciar serviço
sudo systemctl start depara

# Verificar status
sudo systemctl status depara

# Ver logs
sudo journalctl -u depara -f
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

## 📋 Checklist de Instalação

- [ ] Sistema Raspbian atualizado
- [ ] Node.js 18.x instalado
- [ ] Dependências do sistema instaladas
- [ ] Repositório DePara clonado
- [ ] Dependências npm instaladas
- [ ] Arquivo .env configurado
- [ ] Diretório de logs criado
- [ ] Permissões configuradas
- [ ] Serviço systemd criado (opcional)
- [ ] Firewall configurado
- [ ] Aplicação testada
- [ ] Acesso remoto testado

---

**🍓 DePara no Raspbian** - Transformando dados com simplicidade e eficiência no Raspberry Pi! 🚀
