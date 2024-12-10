# Sistema de Alvará com Geração de Pagamentos via PIX

Este projeto é um sistema de gerenciamento de alvarás que permite o upload de comprovantes de pagamento e a geração de pagamentos via PIX. O sistema utiliza o Tesseract.js para extração de texto de imagens e PDFs, além de outras bibliotecas para manipulação de arquivos e comunicação com APIs.

## Funcionalidades

- **Upload de Comprovantes**: Permite o upload de arquivos PDF e imagens (JPG, PNG) como comprovantes de pagamento.
- **Extração de Texto**: Utiliza Tesseract.js para extrair texto de imagens e PDFs.
- **Geração de Pagamentos via PIX**: Integração com a API do Banco do Brasil para gerar pagamentos via PIX.
- **Verificação de Pagamentos**: Verifica se os pagamentos foram identificados com base nos IDs fornecidos.

## Tecnologias Utilizadas

- **Node.js**: Ambiente de execução para o servidor.
- **Express**: Framework para construção de APIs.
- **Multer**: Middleware para manipulação de uploads de arquivos.
- **Sharp**: Biblioteca para processamento de imagens.
- **Tesseract.js**: Biblioteca para reconhecimento óptico de caracteres (OCR).
- **PDF-Parse**: Biblioteca para extração de texto de arquivos PDF.
- **Axios**: Cliente HTTP para fazer requisições a APIs externas.
- **dotenv**: Para gerenciar variáveis de ambiente.

## Pré-requisitos

- Node.js (v14 ou superior)
- Certificados SSL (para execução em HTTPS)
- Conta no Banco do Brasil para acesso à API de pagamentos via PIX

## Instalação

1. Clone o repositório:

   ```bash
   git clone https://github.com/seu-usuario/seu-repositorio.git
   cd seu-repositorio

   
2. Instale as dependências:
   

   ```bash
   npm install


3. Crie um arquivo .env na raiz do projeto e adicione suas credenciais:

   ```bash
   CLIENT_ID=seu_client_id
   CLIENT_SECRET=seu_client_secret

4. Certifique-se de que os diretórios uploads/ e ssl.key/ existem e que os certificados SSL estão no diretório correto.

## EXECUÇÃO

1- esta rodando dentro do conteiner de Docker : docker run -d -p 3000:3000 --name sistemabancario bancodobrasil

2- docker ps
