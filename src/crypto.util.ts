import {RSA_PKCS1_OAEP_PADDING} from "constants"
import {privateDecrypt, RsaPrivateKey} from "crypto"
import * as fs from "fs"

export function decryptMessage(privateKeyPath: string, encryptedValue: string) {
  try {
    if (privateKeyPath !== "") {
      // Convert base64 encrypted string to Buffer
      const encryptedBuffer = Buffer.from(encryptedValue, "base64") // Fixed: using encryptedValue instead of privateKeyPath

      const options = {
        key: fs.readFileSync(privateKeyPath, "utf8"),
        padding: RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      } as RsaPrivateKey

      const decryptedData = privateDecrypt(options, encryptedBuffer)

      console.log("Decryption successful.")
      console.log(`Decrypted data length: ${decryptedData.length}`)

      return decryptedData.toString("utf8")
    } else {
      console.log("No private key path provided. Returning original value.")
      // If no private key path is provided, return the original value
      // This handles cases where the value is not encrypted in the environment
      return encryptedValue
    }
  } catch (error: any) {
    console.error("Decryption failed:", error)
    console.error("Error stack:", error.stack)
    throw new Error(`Decryption failed: ${error.message}`)
  }
}
