<<<<<<< HEAD
import express from 'express'; // Importa o framework Express para criar servidores e gerenciar rotas
import path from 'path'; // Importa a biblioteca path para manipulação de caminhos de arquivos e diretórios
import https from 'https'; // Importa o módulo https para criar servidores seguros com SSL/TLS
import fs from 'fs'; // Importa o módulo fs para leitura e escrita de arquivos no sistema
import cors from 'cors'; // Importa o middleware cors para habilitar o compartilhamento de recursos entre diferentes origens
import { fileURLToPath } from 'url'; // Importa a função fileURLToPath para resolver URLs para caminhos de arquivos
import { dirname } from 'path'; // Importa a função dirname para obter o diretório de um arquivo a partir de um caminho
import axios from 'axios'; // Importa a biblioteca axios para fazer requisições HTTP de forma simplificada
import dotenv from 'dotenv'; // Importa a biblioteca dotenv para carregar variáveis de ambiente de um arquivo .env
import QRCode from 'qrcode'; // Importa a biblioteca qrcode para gerar códigos QR
import multer from 'multer'; // Importa a biblioteca multer para manipulação de uploads de arquivos
import pdf from 'pdf-parse'; // Importa a biblioteca pdf-parse para leitura e análise de arquivos PDF


dotenv.config(); 

const __filename = fileURLToPath(import.meta.url); 
const __dirname = dirname(__filename); 

const app = express(); 

const keyPath = 'ssl.key/server.key'; 
const certPath = 'ssl.crt/server.crt'; 

const CLIENT_ID = process.env.CLIENT_ID; 
const CLIENT_SECRET = process.env.CLIENT_SECRET; 
const OAUTH2_ENDPOINT = 'https://oauth.sandbox.bb.com.br'; 
const API_ENDPOINT = 'https://api.sandbox.bb.com.br'; 

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); 
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`); 
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /pdf/; // Permitir apenas PDFs
        const mimetype = filetypes.test(file.mimetype); 
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase()); 

        if (mimetype && extname) {
            return cb(null, true); 
        } else {
            cb(new Error('Apenas arquivos PDF são permitidos.')); 
        }
    }
});

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) { 
    const sslOptions = {
        key: fs.readFileSync(keyPath), 
        cert: fs.readFileSync(certPath), 
    };

    app.use(cors({ 
        origin: '*', 
        methods: ['GET', 'POST'], 
        headers: ['Content-Type', 'Authorization'], 
    }));

    app.use(express.json()); 
    app.use(express.static(path.join(__dirname, 'public'))); 

        // Lista de alvarás disponíveis
        const alvaras = [
            { id: 1, nome: 'Alvará de Licença para Construção', valor: 1.00 },
            { id: 2, nome: 'Alvará de Cadastramento de Imovel', valor: 2.00 },
            { id: 3, nome: 'Alvará de Cancelamento de Inscrição', valor: 100.0 },
            { id: 4, nome: 'Alvará de Revisão do Imóvel', valor: 100.0 },
            { id: 5, nome: 'Alvará de Reativação do Imóvel', valor: 250.0 },
            { id: 6, nome: 'Alvará de Unificação dos Lotes', valor: 500.0 },
            { id: 7, nome: 'Alvará de Autorização Ambiental', valor: 600.0 },
            { id: 8, nome: 'Alvará de Cancelamento de Alvará', valor: 500.0 },
            { id: 9, nome: 'Alvará de Pré-Análise de Aprovação de Loteamentos', valor: 600.0 },
            { id: 10, nome: 'Alvará de Pré-Análise de Condomínios Horizontais', valor: 600.0 },
            { id: 11, nome: 'Alvará de Abertura de sub-lotes', valor: 600.0 },
            { id: 12, nome: 'Alvará de Solicitação de Alteração de Titularidade do Processo', valor: 600.0 },
            { id: 13, nome: 'Alvará de Certidão de alinhamento', valor: 6.00 },
            { id: 14, nome: 'Alvará de dimensões e confrontações', valor: 6.00 },
            { id: 15, nome: 'Alvará de Certidão de Uso e Ocupação do Solo', valor: 0.01 },
            { id: 16, nome: 'Alvará Auto Declaratório (Alvará 48h) para Canteiro de Obras', valor: 0.01 },
            { id: 17, nome: 'Alvará Auto Declaratório (Alvará 48h) para Construção de Muro', valor: 0.01 },
        ];

    app.get('/alvaras', (req, res) => { 
        res.json(alvaras); 
    });

    // Rota para gerar pagamento via PIX
    app.post('/gerar-pix', async (req, res) => { // Rota para gerar pagamento via PIX
        const { alvaraId, email, identificationType, identificationNumber } = req.body; // Extrai dados do corpo da requisição

        if (!email || !identificationType || !identificationNumber) { // Verifica se todos os campos obrigatórios estão presentes
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' }); // Retorna erro caso falte algum campo
        }

        const alvara = alvaras.find(a => a.id === alvaraId); // Encontra o alvará pelo ID
        if (!alvara) { // Verifica se o alvará existe
            return res.status(404).json({ error: 'Alvará não encontrado' }); // Retorna erro se não encontrado
        }

        const pixData = { 
            valor: alvara.valor, // Valor do alvará
            chave: email, // Chave PIX do pagador
            identificacao: { // Inclui identificador do usuário
                tipo: identificationType,
                numero: identificationNumber
            }
        };
        try {
            const paymentResponse = await gerarPixBancoDoBrasil(pixData); // Chama função para gerar pagamento no Banco do Brasil
            console.log('Resposta do pagamento:', paymentResponse); // Loga a resposta do pagamento
            res.json({
                mensagem: 'Chave Pix gerada com sucesso',
                init_point: paymentResponse.qrCodeUrl, // URL do QR Code
                qrCode: paymentResponse.qrCodeBase64, // QR Code em Base64
                valor: paymentResponse.valor,
                paymentId: paymentResponse.id // ID do pagamento gerado
            });
        } catch (error) {
            console.error('Erro ao gerar chave Pix:', error); // Loga o erro
            
            // Gera um QR Code genérico e uma chave Pix aleatória
            const randomPixKey = `chave-pix-${Math.random().toString(36).substring(2, 15)}`;
            const genericPixData = `Valor: ${pixData.valor} - Chave: ${randomPixKey}`;
            
            // Define opções do QR Code
            const qrCodeOptions = {
                width: 300, // Largura do QR Code
                margin: 1,  // Margem em torno do QR Code
            };
            
            const qrCodeBase64 = await QRCode.toDataURL(genericPixData, qrCodeOptions); // Gera QR Code genérico
            console.log('QR Code Base64:', qrCodeBase64); // Loga o QR Code gerado
            
            res.json({
                mensagem: 'Erro ao gerar chave Pix, mas aqui está um QR Code genérico.',
                init_point: randomPixKey, // Chave Pix aleatória
                qrCode: qrCodeBase64, // Imagem do QR Code em Base64
                valor: pixData.valor,
            });
        }
    });

     // Rota para verificar o status do pagamento
     app.post('/verificar-pagamento', async (req, res) => {
        const { paymentId } = req.body; // Extrai o ID do pagamento do corpo da requisição

        if (!paymentId) { // Verifica se o ID do pagamento foi fornecido
            return res.status(400).json({ error: 'O ID do pagamento é obrigatório' });
        }

        try {
            const paymentStatus = await verificarPagamento(paymentId); // Chama a função para verificar o pagamento
            res.json(paymentStatus); // Retorna o status do pagamento
        } catch (error) {
            console.error('Erro ao verificar pagamento:', error);
            res.status(500).json({ error: 'Erro ao verificar pagamento' });
        }
    });

    // Função para verificar o status do pagamento
    async function verificarPagamento(paymentId) {
        // Simulação de um ID de pagamento específico
        if (paymentId === 'E0000000020241031173126300692179') {
            return {
                id: paymentId,
                status: 'Pago', // Simula que o pagamento foi realizado
                valor: 0.01, // Valor do pagamento (ajuste conforme necessário)
                data: new Date().toISOString(), // Data do pagamento
            };
        }

        // Se não for o ID simulado, faça a chamada real à API
        const accessToken = await obterAccessToken(); // Função para obter o access token

        try {
            const response = await axios.get(`${API_ENDPOINT}/pagamentos/${paymentId}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            return response.data; // Retorna os dados do pagamento
        } catch (error) {
            console.error('Erro ao verificar pagamento:', error);
            throw error; // Lança o erro para ser tratado na rota
        }
    }

    // Função para obter o access token
    async function obterAccessToken() {
        const authResponse = await axios.post(`${OAUTH2_ENDPOINT}/oauth/token`, null, {
            params: {
                grant_type: 'client_credentials',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });

        return authResponse.data.access_token; // Retorna o token de acesso
    }

    // Rota para o indexcomprovante.html
    app.get('/indexcomprovante', (req, res) => {
        res.sendFile(path.join(__dirname, 'indexcomprovante.html')); 
    });

    // Rota para upload do comprovante
    app.post('/upload-comprovante', upload.single('comprovante'), (req, res) => {
        console.log('Rota de upload chamada'); 
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado ou tipo de arquivo inválido.' });
        }
        console.log('Arquivo recebido:', req.file);

        const filePath = req.file.path; 

        // Lê o PDF
        fs.readFile(filePath, (err, data) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao ler o arquivo.' });
            }
        
            pdf(data).then((pdfData) => {
                const content = pdfData.text; 
                const idToCheck = 'E0000000020241031173126300692179'; 
        
                // Verifica se o ID está no conteúdo do PDF
                if (content.includes(idToCheck)) {
                    res.json({ message: 'Comprovante enviado com sucesso!', status: 'Pago' });
                } else {
                    res.json({ error: 'ID não encontrado no comprovante.' });
                }
        
                // Remove o arquivo após o processamento (opcional)
                fs.unlink(filePath, (err) => {
                    if (err) console.error('Erro ao deletar o arquivo:', err);
                });
            }).catch(err => {
                console.error('Erro ao processar o PDF:', err);
                res.status(500).json({ error: 'Erro ao processar o PDF.' });
            });
        });
    });

    const PORT = 3000; 

    https.createServer(sslOptions, app).listen(PORT, () => { 
        console.log(`Servidor rodando em https://localhost:${PORT}`); 
    });
} else { 
    console.error('Arquivos de certificado SSL não encontrados'); 
    process.exit(1); 
}

// Função para gerar PIX no Banco do Brasil
async function gerarPixBancoDoBrasil(pixData) {
    // Autenticação para obter o token de acesso
    const authResponse = await axios.post(`${OAUTH2_ENDPOINT}/oauth/token`, null, {
        params: {
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        },
        httpsAgent: new https.Agent({
            rejectUnauthorized: false
        })
    });

    const accessToken = authResponse.data.access_token; // Extrai o token de acesso

    // Cria a transação PIX
    const pixTransaction = {
        valor: pixData.valor,
        chave: pixData.chave,
        // Outros parâmetros necessários para a transação PIX
    };

    const fs = require('fs');
const path = './test/data/05-versions-space.pdf';

if (fs.existsSync(path)) {
    const data = fs.readFileSync(path);
    // Processar o PDF
} else {
    console.log('Arquivo não encontrado:', path);
}

    const transactionResponse = await axios.post(`${API_ENDPOINT}/pix`, pixTransaction, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    // Retorna os dados da transação
    return {
        qrCodeUrl: transactionResponse.data.qrCodeUrl, // URL do QR Code
        qrCodeBase64 : transactionResponse.data.qrCodeBase64, // QR Code em Base64
        valor: transactionResponse.data.valor,
        id: transactionResponse.data.id, // ID do pagamento
    };
=======
import express from 'express'; // Importa o framework Express para criar servidores e gerenciar rotas
import path from 'path'; // Importa a biblioteca path para manipulação de caminhos de arquivos e diretórios
import https from 'https'; // Importa o módulo https para criar servidores seguros com SSL/TLS
import fs from 'fs'; // Importa o módulo fs para leitura e escrita de arquivos no sistema
import cors from 'cors'; // Importa o middleware cors para habilitar o compartilhamento de recursos entre diferentes origens
import { fileURLToPath } from 'url'; // Importa a função fileURLToPath para resolver URLs para caminhos de arquivos
import { dirname } from 'path'; // Importa a função dirname para obter o diretório de um arquivo a partir de um caminho
import axios from 'axios'; // Importa a biblioteca axios para fazer requisições HTTP de forma simplificada
import dotenv from 'dotenv'; // Importa a biblioteca dotenv para carregar variáveis de ambiente de um arquivo .env
import QRCode from 'qrcode'; // Importa a biblioteca qrcode para gerar códigos QR
import multer from 'multer'; // Importa a biblioteca multer para manipulação de uploads de arquivos
import pdf from 'pdf-parse'; // Importa a biblioteca pdf-parse para leitura e análise de arquivos PDF


dotenv.config(); 

const __filename = fileURLToPath(import.meta.url); 
const __dirname = dirname(__filename); 

const app = express(); 

const keyPath = 'ssl.key/server.key'; 
const certPath = 'ssl.crt/server.crt'; 

const CLIENT_ID = process.env.CLIENT_ID; 
const CLIENT_SECRET = process.env.CLIENT_SECRET; 
const OAUTH2_ENDPOINT = 'https://oauth.sandbox.bb.com.br'; 
const API_ENDPOINT = 'https://api.sandbox.bb.com.br'; 

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); 
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`); 
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /pdf/; // Permitir apenas PDFs
        const mimetype = filetypes.test(file.mimetype); 
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase()); 

        if (mimetype && extname) {
            return cb(null, true); 
        } else {
            cb(new Error('Apenas arquivos PDF são permitidos.')); 
        }
    }
});

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) { 
    const sslOptions = {
        key: fs.readFileSync(keyPath), 
        cert: fs.readFileSync(certPath), 
    };

    app.use(cors({ 
        origin: '*', 
        methods: ['GET', 'POST'], 
        headers: ['Content-Type', 'Authorization'], 
    }));

    app.use(express.json()); 
    app.use(express.static(path.join(__dirname, 'public'))); 

        // Lista de alvarás disponíveis
        const alvaras = [
            { id: 1, nome: 'Alvará de Licença para Construção', valor: 1.00 },
            { id: 2, nome: 'Alvará de Cadastramento de Imovel', valor: 2.00 },
            { id: 3, nome: 'Alvará de Cancelamento de Inscrição', valor: 100.0 },
            { id: 4, nome: 'Alvará de Revisão do Imóvel', valor: 100.0 },
            { id: 5, nome: 'Alvará de Reativação do Imóvel', valor: 250.0 },
            { id: 6, nome: 'Alvará de Unificação dos Lotes', valor: 500.0 },
            { id: 7, nome: 'Alvará de Autorização Ambiental', valor: 600.0 },
            { id: 8, nome: 'Alvará de Cancelamento de Alvará', valor: 500.0 },
            { id: 9, nome: 'Alvará de Pré-Análise de Aprovação de Loteamentos', valor: 600.0 },
            { id: 10, nome: 'Alvará de Pré-Análise de Condomínios Horizontais', valor: 600.0 },
            { id: 11, nome: 'Alvará de Abertura de sub-lotes', valor: 600.0 },
            { id: 12, nome: 'Alvará de Solicitação de Alteração de Titularidade do Processo', valor: 600.0 },
            { id: 13, nome: 'Alvará de Certidão de alinhamento', valor: 6.00 },
            { id: 14, nome: 'Alvará de dimensões e confrontações', valor: 6.00 },
            { id: 15, nome: 'Alvará de Certidão de Uso e Ocupação do Solo', valor: 0.01 },
            { id: 16, nome: 'Alvará Auto Declaratório (Alvará 48h) para Canteiro de Obras', valor: 0.01 },
            { id: 17, nome: 'Alvará Auto Declaratório (Alvará 48h) para Construção de Muro', valor: 0.01 },
        ];

    app.get('/alvaras', (req, res) => { 
        res.json(alvaras); 
    });

    // Rota para gerar pagamento via PIX
    app.post('/gerar-pix', async (req, res) => { // Rota para gerar pagamento via PIX
        const { alvaraId, email, identificationType, identificationNumber } = req.body; // Extrai dados do corpo da requisição

        if (!email || !identificationType || !identificationNumber) { // Verifica se todos os campos obrigatórios estão presentes
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' }); // Retorna erro caso falte algum campo
        }

        const alvara = alvaras.find(a => a.id === alvaraId); // Encontra o alvará pelo ID
        if (!alvara) { // Verifica se o alvará existe
            return res.status(404).json({ error: 'Alvará não encontrado' }); // Retorna erro se não encontrado
        }

        const pixData = { 
            valor: alvara.valor, // Valor do alvará
            chave: email, // Chave PIX do pagador
            identificacao: { // Inclui identificador do usuário
                tipo: identificationType,
                numero: identificationNumber
            }
        };
        try {
            const paymentResponse = await gerarPixBancoDoBrasil(pixData); // Chama função para gerar pagamento no Banco do Brasil
            console.log('Resposta do pagamento:', paymentResponse); // Loga a resposta do pagamento
            res.json({
                mensagem: 'Chave Pix gerada com sucesso',
                init_point: paymentResponse.qrCodeUrl, // URL do QR Code
                qrCode: paymentResponse.qrCodeBase64, // QR Code em Base64
                valor: paymentResponse.valor,
                paymentId: paymentResponse.id // ID do pagamento gerado
            });
        } catch (error) {
            console.error('Erro ao gerar chave Pix:', error); // Loga o erro
            
            // Gera um QR Code genérico e uma chave Pix aleatória
            const randomPixKey = `chave-pix-${Math.random().toString(36).substring(2, 15)}`;
            const genericPixData = `Valor: ${pixData.valor} - Chave: ${randomPixKey}`;
            
            // Define opções do QR Code
            const qrCodeOptions = {
                width: 300, // Largura do QR Code
                margin: 1,  // Margem em torno do QR Code
            };
            
            const qrCodeBase64 = await QRCode.toDataURL(genericPixData, qrCodeOptions); // Gera QR Code genérico
            console.log('QR Code Base64:', qrCodeBase64); // Loga o QR Code gerado
            
            res.json({
                mensagem: 'Erro ao gerar chave Pix, mas aqui está um QR Code genérico.',
                init_point: randomPixKey, // Chave Pix aleatória
                qrCode: qrCodeBase64, // Imagem do QR Code em Base64
                valor: pixData.valor,
            });
        }
    });

     // Rota para verificar o status do pagamento
     app.post('/verificar-pagamento', async (req, res) => {
        const { paymentId } = req.body; // Extrai o ID do pagamento do corpo da requisição

        if (!paymentId) { // Verifica se o ID do pagamento foi fornecido
            return res.status(400).json({ error: 'O ID do pagamento é obrigatório' });
        }

        try {
            const paymentStatus = await verificarPagamento(paymentId); // Chama a função para verificar o pagamento
            res.json(paymentStatus); // Retorna o status do pagamento
        } catch (error) {
            console.error('Erro ao verificar pagamento:', error);
            res.status(500).json({ error: 'Erro ao verificar pagamento' });
        }
    });

    // Função para verificar o status do pagamento
    async function verificarPagamento(paymentId) {
        // Simulação de um ID de pagamento específico
        if (paymentId === 'E0000000020241031173126300692179') {
            return {
                id: paymentId,
                status: 'Pago', // Simula que o pagamento foi realizado
                valor: 0.01, // Valor do pagamento (ajuste conforme necessário)
                data: new Date().toISOString(), // Data do pagamento
            };
        }

        // Se não for o ID simulado, faça a chamada real à API
        const accessToken = await obterAccessToken(); // Função para obter o access token

        try {
            const response = await axios.get(`${API_ENDPOINT}/pagamentos/${paymentId}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            return response.data; // Retorna os dados do pagamento
        } catch (error) {
            console.error('Erro ao verificar pagamento:', error);
            throw error; // Lança o erro para ser tratado na rota
        }
    }

    // Função para obter o access token
    async function obterAccessToken() {
        const authResponse = await axios.post(`${OAUTH2_ENDPOINT}/oauth/token`, null, {
            params: {
                grant_type: 'client_credentials',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });

        return authResponse.data.access_token; // Retorna o token de acesso
    }

    // Rota para o indexcomprovante.html
    app.get('/indexcomprovante', (req, res) => {
        res.sendFile(path.join(__dirname, 'indexcomprovante.html')); 
    });

    // Rota para upload do comprovante
    app.post('/upload-comprovante', upload.single('comprovante'), (req, res) => {
        console.log('Rota de upload chamada'); 
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado ou tipo de arquivo inválido.' });
        }
        console.log('Arquivo recebido:', req.file);

        const filePath = req.file.path; 

        // Lê o PDF
        fs.readFile(filePath, (err, data) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao ler o arquivo.' });
            }
        
            pdf(data).then((pdfData) => {
                const content = pdfData.text; 
                const idToCheck = 'E0000000020241031173126300692179'; 
        
                // Verifica se o ID está no conteúdo do PDF
                if (content.includes(idToCheck)) {
                    res.json({ message: 'Comprovante enviado com sucesso!', status: 'Pago' });
                } else {
                    res.json({ error: 'ID não encontrado no comprovante.' });
                }
        
                // Remove o arquivo após o processamento (opcional)
                fs.unlink(filePath, (err) => {
                    if (err) console.error('Erro ao deletar o arquivo:', err);
                });
            }).catch(err => {
                console.error('Erro ao processar o PDF:', err);
                res.status(500).json({ error: 'Erro ao processar o PDF.' });
            });
        });
    });

    const PORT = 3000; 

    https.createServer(sslOptions, app).listen(PORT, () => { 
        console.log(`Servidor rodando em https://localhost:${PORT}`); 
    });
} else { 
    console.error('Arquivos de certificado SSL não encontrados'); 
    process.exit(1); 
}

// Função para gerar PIX no Banco do Brasil
async function gerarPixBancoDoBrasil(pixData) {
    // Autenticação para obter o token de acesso
    const authResponse = await axios.post(`${OAUTH2_ENDPOINT}/oauth/token`, null, {
        params: {
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        },
        httpsAgent: new https.Agent({
            rejectUnauthorized: false
        })
    });

    const accessToken = authResponse.data.access_token; // Extrai o token de acesso

    // Cria a transação PIX
    const pixTransaction = {
        valor: pixData.valor,
        chave: pixData.chave,
        // Outros parâmetros necessários para a transação PIX
    };

    const fs = require('fs');
const path = './test/data/05-versions-space.pdf';

if (fs.existsSync(path)) {
    const data = fs.readFileSync(path);
    // Processar o PDF
} else {
    console.log('Arquivo não encontrado:', path);
}

    const transactionResponse = await axios.post(`${API_ENDPOINT}/pix`, pixTransaction, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    // Retorna os dados da transação
    return {
        qrCodeUrl: transactionResponse.data.qrCodeUrl, // URL do QR Code
        qrCodeBase64 : transactionResponse.data.qrCodeBase64, // QR Code em Base64
        valor: transactionResponse.data.valor,
        id: transactionResponse.data.id, // ID do pagamento
    };
>>>>>>> ca11f75964b6d1c112d89dffdec614d4bacfc7c8
}