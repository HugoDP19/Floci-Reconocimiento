require("dotenv").config();
const express = require("express")
const multer = require("multer")
const path = require("path")

//Cliente que gestione servicios AWS
const { RekognitionClient, DetectLabelsCommand } = require("@aws-sdk/client-rekognition");

//OPCIONAL (considere cuando se realice pruebas con FLOCI)
//Respuesta prueba...

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

//Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`)
})