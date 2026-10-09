require("dotenv").config();
const express = require("express")
const multer = require("multer")
const path = require("path")

//Cliente que gestione servicios AWS
const { RekognitionClient, DetectLabelsCommand } = require("@aws-sdk/client-rekognition");

//OPCIONAL (considere cuando se realice pruebas con FLOCI)
//Configuración del mockup (dato de prueba)
const { mockClient } = require("aws-sdk-client-mock")
const rekognitionMock = mockClient(RekognitionClient)
//fin mockup

//Cliente Textract (extracción de texto de PDF)
const { TextractClient, DetectDocumentTextCommand } = require("@aws-sdk/client-textract");

//Mock de Textract: devuelve un bloque LINE con el texto detectado
const textractMock = mockClient(TextractClient)
textractMock.on(DetectDocumentTextCommand).resolves({
    Blocks: [
        { BlockType: 'LINE', Text: 'floci', Confidence: 99.9 }
    ]
})

//Definir la respusta personalizada
//Cliente detecte evento, devolvera...
rekognitionMock.on(DetectLabelsCommand).resolves({
    Labels: [
        {Name: 'Hombre', Confidence: 99.4 },
        {Name: 'Mujer', Confidence: 96.1 },
        {Name: 'Niño', Confidence: 80.3 },
        {Name: 'Perro', Confidence: 98.4 }
    ]
})

const app = express()
const port = process.env.PORT || 3000

//Iniciar servicio de reconocimiento
const rekognitionClient = new RekognitionClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: 'http://localhost:4566',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})

//Configuración multer (upload archivos imagen)
const upload = multer({ storage: multer.memoryStorage() })

//Cliente Textract
const textractClient = new TextractClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: 'http://localhost:4566',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})

//Multer para PDF: un solo archivo en memoria, máximo 5 MB
const uploadPdf = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
})

app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())

//Ruta para procesar la imagen
//VERBO -> RUTA -> ACCIÓN -> FUNCIÓN ASINCRONA (solicitud, respuesta)
app.post('/api/analizar', upload.single('imagen'), async(req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se adjunto una imagén valida' })
        }

        //El buffer de la imagen subida
        const imageBuffer = req.file.buffer

        //Configurar el comando para detectar etiquetas (ML / Simulación)
        const params = {
            Image: { Bytes: imageBuffer },
            MaxLabels: 10,
            MinConfidence: 75,

        }

        //Instanciar el comando de detección
        const command = new DetectLabelsCommand(params)
        const response = await rekognitionClient.send(command)

        //Enviar la respuesta al front con JSON
        res.json({
            success: true,
            labels: response.Labels
        })

    }catch(error){
        console.error(`Error en el servicio AWS:`, error)
        res.status(500).json({
            error: 'No se concreto el analisis en AWS Rekognition',
            details: error.message,
            code: error.name
        })
    }
})

//Ruta para procesar el PDF
app.post('/api/analizar-pdf', uploadPdf.single('archivo'), async (req, res) => {
    try {
        //1. Validar que exista el archivo y sea PDF
        if (!req.file || req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ success: false, message: 'Debe adjuntar un archivo PDF válido' })
        }

        //2. Enviar el buffer del PDF a Textract
        const command = new DetectDocumentTextCommand({
            Document: { Bytes: req.file.buffer }
        })
        const response = await textractClient.send(command)

        //3. Quedarnos solo con los bloques de tipo LINE
        const resultado = response.Blocks
            .filter((block) => block.BlockType === 'LINE')
            .map((block) => ({
                text: block.Text,
                confidence: `${block.Confidence}%`
            }))

        //4. Responder al front
        res.json({ success: true, resultado })

    } catch (error) {
        console.error('Error en Textract:', error)
        res.status(500).json({ success: false, message: error.message })
    }
})

//Errores de Multer (ej. archivo mayor a 5 MB)
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: error.message })
    }
    next(error)
})

//Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`)
})