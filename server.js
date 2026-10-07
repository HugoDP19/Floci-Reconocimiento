require("dotenv").config()
const express = require("express")
const multer = require("multer")
const path = require("path")

//Cliente que gestione servicios AWS
const { Rekognition, DetectLabelsCommand } = require("@aws-sdk/client-rekognition")

//OPCIONAL (considere cuando se realice pruebas con FLOCI)
//Respuesta prueba...

const app = express()
const port = process.env.PORT || 3000

//Iniciar servicio de reconocimiento
const rekognitionClient = new RekognitionClient({
    region: process.env.AWS_REGION,
    endpoint: 'http://localhost:4566',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})

//Configuración multer (upload archivos imagen)
const multer = multer({ storage: multer.memoryStorage() })

app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())

//Ruta para procesar la imagen
//VERBO -> RUTA -> ACCIÓN -> FUNCIÓN ASINCRONA (solicitud, respuesta)
app.post('/api/analizar', upload.single('imagen'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se adjunto una imagén valida' })
        }

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