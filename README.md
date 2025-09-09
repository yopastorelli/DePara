# DePara - Gerenciador Automatizado de Arquivos

## 📋 Descrição

DePara é uma aplicação Node.js moderna e simplificada para gerenciamento automatizado de arquivos. Oferece operações de mover, copiar e apagar arquivos com agendamento flexível, backup automático e um slideshow de imagens integrado. Perfeita para automação de tarefas de arquivo em qualquer ambiente, especialmente otimizada para Raspberry Pi.

## 🚀 Funcionalidades Principais

### 🗂️ **Operações de Arquivos**
- **Mover Arquivos**: Move arquivos entre pastas com backup automático
- **Copiar Arquivos**: Copia arquivos preservando o original
- **Apagar Arquivos**: Remove arquivos com backup automático
- **Agendamento Flexível**: De segundos até dias de intervalo
- **Operações em Lote**: Processa todos os arquivos de uma pasta
- **Preservação de Estrutura**: Mantém ou achata estrutura de pastas conforme preferência

### 🖼️ **Slideshow de Imagens**
- **Visualização Fullscreen**: Apresentação de imagens em tela cheia
- **Navegação Intuitiva**: Teclado, mouse e controles na tela
- **Busca Recursiva**: Inclui todas as subpastas automaticamente
- **Filtros Avançados**: Seleção por tipo de arquivo (JPG, PNG, GIF, etc.)
- **Controles de Ação**: Ocultar e apagar imagens diretamente do slideshow
- **Otimizado para Raspberry Pi**: Performance otimizada para hardware de baixo consumo

### 🛡️ **Sistema de Proteção Inteligente**
- **Arquivos Críticos Protegidos**: Resilio Sync, sistema e temporários
- **Ignorar Automático**: Não interrompe sincronização ou sistema
- **Compatibilidade Total**: Windows, Linux, macOS, Raspberry Pi
- **Verificação Manual**: Teste se arquivo seria ignorado

### 📊 **Monitoramento e Controle**
- **Dashboard Web**: Interface amigável para controle total
- **API REST Completa**: Integração com outros sistemas
- **Logs Estruturados**: Monitoramento detalhado de operações
- **Backup Automático**: Proteção antes de qualquer operação

## 📋 Pré-requisitos

- **Node.js**: Versão 16.0.0 ou superior
- **npm**: Versão 8.0.0 ou superior
- **Git**: Para clonar o repositório

### Verificação das Versões

```bash
node --version
npm --version
git --version
```

## 🛠️ Instalação

### 🚀 **Instalação Automática (Recomendado)**

#### Windows
```batch
# Execute o instalador automático
install.bat
```

#### Linux/macOS
```bash
# Execute o instalador automático
./install.sh
```

#### Raspberry Pi
```bash
# Instalação específica para Raspberry Pi
./install-raspberry.sh
```

### 🔧 **Instalação Manual**

#### 1. Clonar o Repositório
```bash
git clone https://github.com/yopastorelli/DePara.git
cd DePara
```

#### 2. Instalar Dependências
```bash
npm install
```

#### 3. Configurar Ambiente
```bash
# Windows
copy env.example .env
notepad .env

# Linux/macOS
cp env.example .env
nano .env
```

#### 4. Executar a Aplicação
```bash
# Modo desenvolvimento
npm run dev

# Modo produção
npm start

# Modo produção com PM2 (recomendado)
npm run start:bg
```

### 🌐 **Acesso Após Instalação**

Após iniciar, acesse:
- **Interface Web**: http://localhost:3000/ui
- **API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/api/health

## 🎯 Como Usar

### 🌐 **Interface Web (Recomendado)**

Acesse `http://localhost:3000/ui` e use a interface amigável para:

#### 1. **Operações Imediatas**
- **Mover/Copiar/Apagar** arquivos individualmente
- **Backup automático** antes de qualquer operação
- **Visualização** do progresso em tempo real

#### 2. **Agendamento Automático**
- Configure operações recorrentes (a cada 5 minutos, 1 hora, diariamente)
- **Monitore** operações agendadas ativas
- **Edite ou cancele** tarefas a qualquer momento

#### 3. **Slideshow de Imagens**
- Clique no botão **"Slideshow de Imagens"** no dashboard
- Selecione a pasta contendo as imagens
- Escolha os tipos de arquivo desejados (JPG, PNG, GIF, etc.)
- Defina a profundidade de busca em subpastas
- Inicie a apresentação em fullscreen
- Use as setas do teclado, roda do mouse ou controles na tela para navegar
- **Oculte ou apague** imagens diretamente do slideshow
- Pressione **ESC** ou clique no botão **X** para sair

### 🔌 **API REST (Para Integração)**

#### Endpoints Principais
- `GET /api/health` - Status da aplicação
- `POST /api/files/execute` - Operações imediatas em arquivos
- `POST /api/files/schedule` - Agendamento de operações
- `GET /api/files/scheduled` - Listar operações agendadas
- `GET /api/files/list-images` - Listar imagens para slideshow
- `GET /api/files/image/:path` - Servir imagem para slideshow

#### Exemplos Práticos

```bash
# Verificar status
curl http://localhost:3000/api/health

# Mover arquivo com backup
curl -X POST http://localhost:3000/api/files/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "move",
    "sourcePath": "/origem/arquivo.txt",
    "targetPath": "/destino/arquivo.txt",
    "options": {
      "backupBeforeMove": true,
      "preserveStructure": true
    }
  }'

# Agendar backup diário
curl -X POST http://localhost:3000/api/files/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "frequency": "1d",
    "action": "copy",
    "sourcePath": "/dados",
    "targetPath": "/backup/diario",
    "options": {
      "batch": true,
      "preserveStructure": true
    }
  }'

# Listar imagens para slideshow
curl "http://localhost:3000/api/files/list-images?folderPath=/caminho/imagens&extensions=jpg,png,gif&recursive=true"
```

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch

# Executar testes com cobertura
npm run test:coverage
```

## 🔧 Desenvolvimento

### Scripts Disponíveis

- `npm start` - Inicia a aplicação em modo produção
- `npm run dev` - Inicia em modo desenvolvimento com nodemon
- `npm run start:bg` - Inicia em segundo plano com PM2
- `npm run stop:bg` - Para a aplicação em segundo plano
- `npm run restart:bg` - Reinicia a aplicação em segundo plano
- `npm run status` - Verifica status da aplicação PM2
- `npm run logs` - Visualiza logs da aplicação PM2
- `npm test` - Executa os testes
- `npm run lint` - Executa o linter ESLint

### Estrutura do Projeto

```
DePara/
├── src/                    # Código fonte
│   ├── main.js            # Arquivo principal
│   ├── routes/            # Rotas da API
│   ├── utils/             # Utilitários
│   ├── middleware/        # Middlewares
│   └── public/            # Interface web
├── tests/                 # Testes automatizados
├── docs/                  # Documentação adicional
├── logs/                  # Arquivos de log
├── package.json           # Dependências e scripts
├── .gitignore            # Arquivos ignorados pelo Git
├── env.example           # Exemplo de variáveis de ambiente
└── README.md             # Este arquivo
```

## 🍓 **Suporte Especial para Raspberry Pi**

### Instalação no Raspberry Pi
```bash
# Instalação automática
./install-raspberry.sh

# Configuração como serviço
sudo systemctl enable depara
sudo systemctl start depara
```

### Otimizações Incluídas
- **Detecção automática** de hardware Raspberry Pi
- **Correção de permissões** automática
- **Performance otimizada** para ARM
- **Logs específicos** para debugging

## 📝 Logs

A aplicação gera logs estruturados para facilitar o debug e monitoramento:

- **Nível**: info, warn, error, debug
- **Localização**: `logs/app.log`
- **Formato**: JSON estruturado com timestamp

## 🆘 Troubleshooting

### Problemas Comuns

#### 1. **Erro de Permissão no Raspberry Pi**
```bash
# Corrigir permissões
sudo chown -R pi:pi /caminho/do/projeto
sudo chmod -R 755 /caminho/do/projeto
```

#### 2. **Slideshow não carrega imagens**
- Verifique se a pasta existe e tem permissão de leitura
- Confirme se as extensões estão corretas
- Verifique os logs da aplicação

#### 3. **API retorna erro 500**
- Verifique os logs em `logs/app.log`
- Confirme se os caminhos de arquivo estão corretos
- Verifique permissões de escrita nas pastas de destino

#### 4. **Aplicação não inicia**
```bash
# Verificar dependências
npm install

# Verificar logs
npm run logs

# Reiniciar aplicação
npm run restart:bg
```

## 🤝 Como Contribuir

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

Se encontrar algum problema ou tiver dúvidas:

1. Verifique os logs da aplicação
2. Consulte a documentação da API em `docs/API.md`
3. Abra uma issue no GitHub
4. Entre em contato com a equipe de desenvolvimento

## 🔄 Atualizações

Para manter o projeto atualizado:

```bash
git pull origin main
npm install
npm run restart:bg
```

---

**DePara** - Gerenciando arquivos com simplicidade e eficiência! 🚀