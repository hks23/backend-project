import multer from "multer";

//we are using DiskStorage can also use Memory Storage
//multer or express-fileUplaod is used for middle work
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './public/temp') //cb is call back function
    },
    filename: function (req, file, cb) {
      
      cb(null, file.originalname)
    }
  })
  
export const upload = multer(
    { 
        storage,
    }
 )