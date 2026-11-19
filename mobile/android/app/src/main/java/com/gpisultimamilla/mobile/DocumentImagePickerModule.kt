package com.gpisultimamilla.mobile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DocumentImagePickerModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var pendingPromise: Promise? = null

  private val activityEventListener: ActivityEventListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
      ) {
        if (requestCode != PICK_IMAGE_REQUEST) return
        val promise = pendingPromise ?: return
        pendingPromise = null

        if (resultCode != Activity.RESULT_OK || data?.data == null) {
          promise.resolve(null)
          return
        }

        try {
          val uri = data.data!!
          val payload = readAndValidateImage(uri)
          promise.resolve(payload)
        } catch (error: Exception) {
          promise.reject("PICK_IMAGE_ERROR", error.message ?: "No se pudo leer la imagen.")
        }
      }
    }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "DocumentImagePicker"

  @ReactMethod
  fun pickImage(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "La pantalla no está activa.")
      return
    }
    if (pendingPromise != null) {
      promise.reject("PICKER_BUSY", "Ya existe una selección de imagen abierta.")
      return
    }
    pendingPromise = promise

    val intent =
      Intent(Intent.ACTION_GET_CONTENT).apply {
        type = "image/*"
        putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/jpeg", "image/png"))
        addCategory(Intent.CATEGORY_OPENABLE)
      }
    activity.startActivityForResult(Intent.createChooser(intent, "Seleccionar imagen JPEG o PNG"), PICK_IMAGE_REQUEST)
  }

  private fun readAndValidateImage(uri: Uri): com.facebook.react.bridge.WritableMap {
    val resolver = reactApplicationContext.contentResolver
    val bytes =
      resolver.openInputStream(uri)?.use { stream ->
        val buffer = stream.readBytes()
        if (buffer.size > MAX_BYTES) {
          throw IllegalArgumentException("El archivo excede el máximo de 5 MB.")
        }
        buffer
      } ?: throw IllegalArgumentException("No se pudo abrir la imagen seleccionada.")

    val contentType = detectContentType(bytes)
      ?: throw IllegalArgumentException("Solo se aceptan imágenes JPEG o PNG válidas.")

    var fileName = "documento.${if (contentType == "image/png") "png" else "jpg"}"
    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) {
        val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (index >= 0) {
          val rawName = cursor.getString(index)
          if (!rawName.isNullOrBlank()) {
            fileName = rawName
          }
        }
      }
    }

    return Arguments.createMap().apply {
      putString("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
      putString("contentType", contentType)
      putInt("sizeBytes", bytes.size)
      putString("fileName", fileName)
    }
  }

  private fun detectContentType(bytes: ByteArray): String? {
    if (bytes.size >= 3 &&
      (bytes[0].toInt() and 0xFF) == 0xFF &&
      (bytes[1].toInt() and 0xFF) == 0xD8 &&
      (bytes[2].toInt() and 0xFF) == 0xFF
    ) {
      return "image/jpeg"
    }
    if (bytes.size >= 8 &&
      (bytes[0].toInt() and 0xFF) == 0x89 &&
      (bytes[1].toInt() and 0xFF) == 0x50 &&
      (bytes[2].toInt() and 0xFF) == 0x4E &&
      (bytes[3].toInt() and 0xFF) == 0x47 &&
      (bytes[4].toInt() and 0xFF) == 0x0D &&
      (bytes[5].toInt() and 0xFF) == 0x0A &&
      (bytes[6].toInt() and 0xFF) == 0x1A &&
      (bytes[7].toInt() and 0xFF) == 0x0A
    ) {
      return "image/png"
    }
    return null
  }

  companion object {
    private const val PICK_IMAGE_REQUEST = 4812
    private const val MAX_BYTES = 5 * 1024 * 1024
  }
}
