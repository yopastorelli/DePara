[1mdiff --git a/package.json b/package.json[m
[1mindex f988775..bbcc2ad 100644[m
[1m--- a/package.json[m
[1m+++ b/package.json[m
[36m@@ -5,6 +5,12 @@[m
   "main": "src/main.js",[m
   "scripts": {[m
     "start": "node src/main.js",[m
[32m+[m[32m    "start:bg": "pm2 start src/main.js --name DePara",[m
[32m+[m[32m    "start:bg:prod": "pm2 start src/main.js --name DePara --env production",[m
[32m+[m[32m    "stop:bg": "pm2 stop DePara",[m
[32m+[m[32m    "restart:bg": "pm2 restart DePara",[m
[32m+[m[32m    "status": "pm2 status",[m
[32m+[m[32m    "logs": "pm2 logs DePara",[m
     "dev": "nodemon src/main.js",[m
     "test": "jest",[m
     "test:watch": "jest --watch",[m
[36m@@ -12,7 +18,8 @@[m
     "lint": "eslint src/",[m
     "lint:fix": "eslint src/ --fix",[m
     "setup": "npm install",[m
[31m-    "postinstall": "node -e \"console.log('✅ DePara instalado com sucesso! Use npm start para iniciar.')\""[m
[32m+[m[32m    "setup:bg": "npm install && npm install -g pm2",[m
[32m+[m[32m    "postinstall": "node -e \"console.log('✅ DePara instalado com sucesso! Use npm run start:bg para iniciar em segundo plano.')\""[m
   },[m
   "keywords": [[m
     "conversao",[m
[36m@@ -33,7 +40,8 @@[m
     "nodemon": "^3.0.2",[m
     "jest": "^29.7.0",[m
     "eslint": "^8.56.0",[m
[31m-    "supertest": "^6.3.3"[m
[32m+[m[32m    "supertest": "^6.3.3",[m
[32m+[m[32m    "pm2": "^5.3.0"[m
   },[m
   "engines": {[m
     "node": ">=16.0.0",[m
