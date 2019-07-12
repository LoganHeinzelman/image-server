const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const config = require("../config.json");
const blacklisted = [".exe", ".bat", ".cmd", ".msi", ".sh"];

const uploadDir = path.join(__dirname, "..", "data", "uploads");

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        const [month, day, year] = new Date().toLocaleDateString("en-US", { timeZone: "Australia/Melbourne" }).split("/");
        cb(null, `${day}-${month}-${year}-${Date.now().toString(16)}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (blacklisted.some(extension => ext === extension)) {
            return cb(new Error(`The file extension ${ext.replace(".", "")} is not allowed to be uploaded`), false);
        }
        return cb(null, true);
    }
}).array("files[]");

class Uploads {

    constructor() {
        throw new Error("This class may not be initiated with new");
    }

    static async upload(req, res) {
        upload(req, res, async error => {
            if (error) {
                console.error(error);
                return res.json({ message: error.message || String(error) });
            }

            const files = [];

            if (!req.files || !req.files.length) return res.status(400).json({ message: "No files" });

            for (const file of req.files) {
                files.push({
                    mimetype: file.mimetype,
                    url: `${config.domain}/${file.filename}`,
                    timestamp: Date.now()
                });
            }

            return res.json({ message: `Sucessfully uploaded ${files.length} files`, files });
        });
    }

    static async getFile(req, res) {
        return res.sendFile(req.params.file, {
            root: uploadDir
        });
    }

}

module.exports = Uploads;
