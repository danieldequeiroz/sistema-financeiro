import express from 'express';
import path from 'path';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import multer from 'multer';
import pdf from 'pdf-parse';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { createCanvas, loadImage } from 'canvas';
import Tesseract from 'tesseract.js';

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
        const filetypes = /pdf|jpg|jpeg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Apenas arquivos PDF ou imagens são permitidos.'));
        }
    }
});

// Função para converter PDF em imagens
async function pdfToImages(pdfPath) {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const numPages = pdfDoc.getPageCount();
    const images = [];

    for (let i = 0; i < numPages; i++) {
        const page = pdfDoc.getPage(i);
        const { width, height } = page.getSize();
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');

        // Renderizar a página no canvas
        const pngImage = await page.renderToPng(); // Verifique se este método é válido
        const img = await loadImage(pngImage);
        context.drawImage(img, 0, 0);

        // Salvar a imagem
        const imagePath = `page-${i + 1}.png`;
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(imagePath, buffer);
        images.push(imagePath);
    }

    return images;
}

// Função para extrair texto de uma imagem usando Tesseract
async function extractTextFromImage(imagePath) {
    try {
        const { data: { text } } = await Tesseract.recognize(imagePath, 'por', {
            logger: info => console.log(info) // Log do progresso do reconhecimento
        });
        return text;
    } catch (error) {
        console.error('Erro ao extrair texto da imagem:', error);
        throw error;
    }
}

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
        { id: 16, nome: 'Alvará Auto Declaratório (Alvará 48h) para Canteiro de Obras', valor: 0.01},
        { id: 17, nome: 'Alvará Auto Declaratório (Alvará 48h) para Construção de Muro', valor: 0.01 },
    ];

    app.get('/alvaras', (req, res) => { 
        res.json(alvaras); 
    });

    // Rota para gerar pagamento via PIX
    app.post('/gerar-pix', async (req, res) => {
        const { alvaraId, email, identificationType, identificationNumber } = req.body;

        if (!email || !identificationType || !identificationNumber) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        const alvara = alvaras.find(a => a.id === alvaraId);
        if (!alvara) {
            return res.status(404).json({ error: 'Alvará não encontrado' });
        }

        const pixData = { 
            valor: alvara.valor,
            chave: email,
            identificacao: {
                tipo: identificationType,
                numero: identificationNumber
            }
        };

        try {
            const paymentResponse = await gerarPixBancoDoBrasil(pixData);
            res.json({
                mensagem: 'Chave Pix gerada com sucesso',
                init_point: paymentResponse.qrCodeUrl,
                qrCode: paymentResponse.qrCodeBase64,
                valor: paymentResponse.valor,
                paymentId: paymentResponse.id
            });
        } catch (error) {
            console.error('Erro ao gerar chave Pix:', error);
            const randomPixKey = `chave-pix-${Math.random().toString(36).substring(2, 15)}`;
            const genericPixData = `Valor: ${pixData.valor} - Chave: ${randomPixKey}`;
            const qrCodeOptions = {
                width: 300,
                margin: 1,
            };
            const qrCodeBase64 = await QRCode.toDataURL(genericPixData, qrCodeOptions);
            res.json({
                mensagem: 'Erro ao gerar chave Pix, mas aqui está um QR Code genérico.',
                init_point: randomPixKey,
                qrCode: qrCodeBase64,
                valor: pixData.valor,
            });
        }
    });

    // Rota para verificar o status do pagamento
    app.post('/verificar-pagamento', async (req, res) => {
        const { paymentId } = req.body;

        if (!paymentId) {
            return res.status(400).json({ error: 'O ID do pagamento é obrigatório' });
        }

        try {
            const paymentStatus = await verificarPagamento(paymentId);
            res.json(paymentStatus);
        } catch (error) {
            console.error('Erro ao verificar pagamento:', error);
            res.status(500).json({ error: 'Erro ao verificar pagamento' });
        }
    });

    // Função para verificar o status do pagamento
    async function verificarPagamento(paymentId) {
        if (paymentId === 'E0000000020241031173126300692179') {
            return {
                id: paymentId,
                status: 'Pago',
                valor: 0.01,
                data: new Date().toISOString(),
            };
        }

        const accessToken = await obterAccessToken();

        try {
            const response = await axios.get(`${API_ENDPOINT}/pagamentos/${paymentId}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            console.error('Erro ao verificar pagamento:', error);
            throw error;
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
        return authResponse.data.access_token;
    }

    // Rota para o indexcomprovante.html
    app.get('/indexcomprovante', (req, res) => {
        res.sendFile(path.join(__dirname, 'indexcomprovante.html')); 
    });

    // Rota para upload do comprovante
    app.post('/upload-comprovante', upload.single('comprovante'), (req, res) => {
        console.log('Rota de upload chamada');

        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado ou tipo de arquivo inválido.', status: 'Pendente' });
        }

        const idsToCheck = [
            ' E0000000020241031173126300692179',
            'E00416968202411271407ccRdegdtC41',
            '£60701190202411132009DY5D74ITCOZ',
            '5C7E09416F77D919E9FE1959A39E1958EBE48632'
        ];

        console.log('Arquivo recebido:', req.file);
        const filePath = req.file.path;

        if (path.extname(req.file.originalname).toLowerCase() === '.pdf') {
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    return res.status(500).json({ error: 'Erro ao ler o arquivo.', status: 'Pendente' });
                }

                pdf(data).then((pdfData) => {
                    const content = pdfData.text;
                    const foundIds = idsToCheck.filter(id => content.includes(id));
                    if (foundIds.length > 0) {
                        res.json({ message: 'Comprovante enviado com sucesso! pagamento identificado.', foundIds, status: 'Pago' });
                    } else {
                        res.json({ error: 'Nenhum ID encontrado no comprovante.', foundIds, status: 'Pendente' });
                    }

                    fs.unlink(filePath, (err) => {
                        if (err) console.error('Erro ao deletar o arquivo:', err);
                    });
                }).catch(err => {
                    console.error('Erro ao processar o PDF:', err);
                    res.status(500).json({ error: 'Erro ao processar o PDF.', foundIds: [], status: 'Pendente' });
                });
            });
        } else {
            sharp(filePath)
                .resize(800, 800)
                .toFile(`uploads/resized-${req.file.filename}`, (err, info) => {
                    if (err) {
                        console.error('Erro ao processar a imagem:', err);
                        return res.status(500).json({ error: 'Erro ao processar a imagem.', foundIds: [], status: 'Pendente' });
                    }
                    console.log('Imagem processada com sucesso:', info);

                    Tesseract.recognize(
                        `uploads/resized-${req.file.filename}`,
                        'por',
                        {
                            logger: info => console.log(info)
                        }
                    ).then(({ data: { text } }) => {
                        const foundIds = idsToCheck.filter(id => text.includes(id));
                        if (foundIds.length > 0) {
                            res.json({ message: 'Comprovante enviado e IDs encontrados na imagem!', foundIds, status: 'Pago' });
                        } else {
                            res.json({ error: 'Nenhum ID encontrado na imagem.', foundIds, status: 'Pendente' });
                        }

                        fs.unlink(filePath, (err) => {
                            if (err) console.error('Erro ao deletar o arquivo:', err);
                        });
                    }).catch(err => {
                        console.error('Erro ao processar a imagem:', err);
                        res.status(500).json({ error: 'Erro ao processar a imagem.', foundIds: [], status: 'Pendente' });
                    });
                });
        }
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

    const accessToken = authResponse.data.access_token;

    const pixTransaction = {
        valor: pixData.valor,
        chave: pixData.chave,
        // Outros parâmetros necessários para a transação PIX
    };

    const transactionResponse = await axios.post(`${API_ENDPOINT}/pix`, pixTransaction, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    return {
        qrCodeUrl: transactionResponse.data.qrCodeUrl,
        qrCodeBase64: transactionResponse.data.qrCodeBase64,
        valor: transactionResponse.data.valor,
        id: transactionResponse.data.id,
    };
}

// Rota para upload de imagem
app.post('/upload-imagem', upload.single('imagem'), (req, res) => {
    console.log('Rota de upload de imagem chamada');

    if (!req.file) {
        return res.status(400).json({ error: 'Nenhuma imagem enviada ou tipo de arquivo inválido.', status: 'Pendente' });
    }

    console.log('Arquivo de imagem recebido:', req.file);
    console.log('Tipo MIME do arquivo:', req.file.mimetype);

    const filePath = req.file.path;

    sharp(filePath)
        .resize(800, 800)
        .grayscale()
        .normalize()
        .toFile(`uploads/resized-${req.file.filename}`, (err, info) => {
            if (err) {
                console.error('Erro ao processar a imagem:', err);
                return res.status(500).json({ error: 'Erro ao processar a imagem.', status: 'Pendente' });
            }
            console.log('Imagem redimensionada com sucesso:', info);

            Tesseract.recognize(
                `uploads/resized-${req.file.filename}`,
                'por',
                {
                    logger: info => console.log(info)
                }
            ).then(({ data: { text } }) => {
                console.log('Texto extraído:', text);
                const foundIds = idsToCheck.filter(id => text.includes(id));
                if (foundIds.length > 0) {
                    res.json({ message: 'Comprovante enviado e IDs encontrados na imagem!', foundIds, status: 'Pago' });
                } else {
                    res.json({ error: 'Nenhum ID encontrado na imagem.', foundIds, status: 'Pendente' });
                }
            }).catch(err => {
                console.error('Erro ao processar a imagem:', err);
                res.status(500).json({ error: 'Erro ao processar a imagem.', foundIds: [], status: 'Pendente' });
            });
        });
});