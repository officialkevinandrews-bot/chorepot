package app.chorepot.family

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import app.chorepot.family.ui.theme.ChorepotTheme
import java.io.File

private val ChorepotEmerald = Color(0xFF27765B)
private val ChorepotCream = Color(0xFFFAFCFB)
private val ChorepotSlate = Color(0xFF52605B)

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null
    private var pendingRedirectUrl: String? = null

    private var hasLoadedOnce by mutableStateOf(false)
    private var isPageLoading by mutableStateOf(true)
    private var loadProgress by mutableStateOf(0)
    private var hasLoadError by mutableStateOf(false)
    private var canGoBack by mutableStateOf(false)

    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCameraUri: Uri? = null
    private var pendingCameraFile: File? = null

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        launchPhotoPicker(includeCamera = granted)
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = pendingFileCallback
        pendingFileCallback = null
        val cameraUri = pendingCameraUri
        val cameraFile = pendingCameraFile
        pendingCameraUri = null
        pendingCameraFile = null

        if (callback == null) return@registerForActivityResult

        if (result.resultCode != RESULT_OK) {
            cameraFile?.delete()
            callback.onReceiveValue(null)
            return@registerForActivityResult
        }

        val data = result.data
        val uris = buildList {
            val clip = data?.clipData
            if (clip != null) {
                for (i in 0 until clip.itemCount) {
                    clip.getItemAt(i)?.uri?.let(::add)
                }
            } else {
                data?.data?.let(::add)
            }
            if (isEmpty() && cameraUri != null && cameraFile != null && cameraFile.exists() && cameraFile.length() > 0L) {
                add(cameraUri)
            }
        }

        if (uris.isEmpty() || uris.none { it == cameraUri }) {
            cameraFile?.delete()
        }
        callback.onReceiveValue(if (uris.isNotEmpty()) uris.toTypedArray() else null)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        pendingRedirectUrl = ChorepotUrls.buildWebReturnUrlFromOAuthUri(intent?.dataString)

        setContent {
            ChorepotTheme(darkTheme = false, dynamicColor = false) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = ChorepotCream,
                ) {
                    ChorepotWebShell()
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val oauthReturnUrl = ChorepotUrls.buildWebReturnUrlFromOAuthUri(intent.dataString)
        if (oauthReturnUrl != null) {
            hasLoadError = false
            val view = webView
            if (view != null) {
                view.onResume()
                view.loadUrl(oauthReturnUrl)
            } else {
                pendingRedirectUrl = oauthReturnUrl
            }
        }
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        webView?.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        pendingFileCallback?.onReceiveValue(null)
        pendingFileCallback = null
        webView?.destroy()
        webView = null
        super.onDestroy()
    }

    @Composable
    private fun ChorepotWebShell() {
        BackHandler(enabled = canGoBack) {
            val view = webView
            if (view != null && view.canGoBack()) {
                view.goBack()
            }
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(ChorepotCream)
                .windowInsetsPadding(WindowInsets.safeDrawing),
        ) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    createConfiguredWebView(context).also { created ->
                        webView = created
                        val startUrl = pendingRedirectUrl ?: ChorepotUrls.START_URL
                        pendingRedirectUrl = null
                        created.loadUrl(startUrl)
                    }
                },
            )

            if (isPageLoading && hasLoadedOnce && !hasLoadError) {
                LinearProgressIndicator(
                    progress = { (loadProgress.coerceIn(5, 100)) / 100f },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp)
                        .align(Alignment.TopCenter),
                    color = ChorepotEmerald,
                    trackColor = ChorepotCream,
                )
            }

            if (!hasLoadedOnce && !hasLoadError) {
                LoadingSplashOverlay(progress = loadProgress)
            }

            if (hasLoadError) {
                OfflineRetryOverlay(
                    onRetry = {
                        hasLoadError = false
                        isPageLoading = true
                        webView?.reload()
                    },
                )
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createConfiguredWebView(context: android.content.Context): WebView {
        val view = WebView(context).apply {
            val webViewInstance = this
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
                javaScriptCanOpenWindowsAutomatically = true
                mediaPlaybackRequiresUserGesture = false
                loadWithOverviewMode = true
                useWideViewPort = true
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                userAgentString = "$userAgentString ${ChorepotUrls.CUSTOM_UA_TAG}"
            }

            CookieManager.getInstance().apply {
                setAcceptCookie(true)
                setAcceptThirdPartyCookies(webViewInstance, true)
            }

            addJavascriptInterface(AndroidJsBridge(), "ChorepotAndroid")

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?,
                ): Boolean {
                    val uri = request?.url ?: return false
                    return handleNavigationUri(uri)
                }

                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    isPageLoading = true
                    hasLoadError = false
                    canGoBack = view?.canGoBack() == true
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    isPageLoading = false
                    hasLoadedOnce = true
                    canGoBack = view?.canGoBack() == true
                    CookieManager.getInstance().flush()
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?,
                ) {
                    if (request?.isForMainFrame == true) {
                        isPageLoading = false
                        hasLoadedOnce = true
                        hasLoadError = true
                    }
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                    loadProgress = newProgress
                    if (newProgress >= 85 && !hasLoadedOnce) {
                        hasLoadedOnce = true
                    }
                }

                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?,
                ): Boolean {
                    pendingFileCallback?.onReceiveValue(null)
                    pendingFileCallback = filePathCallback

                    val cameraGranted = ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.CAMERA,
                    ) == PackageManager.PERMISSION_GRANTED

                    if (cameraGranted) {
                        launchPhotoPicker(includeCamera = true)
                    } else {
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    }
                    return true
                }
            }
        }
        return view
    }

    private fun handleNavigationUri(uri: Uri): Boolean {
        val rawUrl = uri.toString()
        when (ChorepotUrls.classifyNavigation(rawUrl)) {
            NavigationTarget.IN_APP -> return false
            NavigationTarget.CUSTOM_TAB_OAUTH, NavigationTarget.EXTERNAL_BROWSER -> {
                openInCustomTab(uri)
                return true
            }
            NavigationTarget.EXTERNAL_APP -> {
                openExternalApp(rawUrl, uri)
                return true
            }
        }
    }

    private fun openInCustomTab(uri: Uri) {
        try {
            val colors = CustomTabColorSchemeParams.Builder()
                .setToolbarColor(0xFF27765B.toInt())
                .build()
            val customTabs = CustomTabsIntent.Builder()
                .setDefaultColorSchemeParams(colors)
                .setShowTitle(true)
                .build()
            customTabs.launchUrl(this, uri)
        } catch (_: Exception) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
            } catch (_: ActivityNotFoundException) {
                Toast.makeText(this, "No browser found to continue sign-in.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun openExternalApp(rawUrl: String, uri: Uri) {
        try {
            val intent = if (rawUrl.startsWith("intent:", ignoreCase = true)) {
                Intent.parseUri(rawUrl, Intent.URI_INTENT_SCHEME)
            } else {
                Intent(Intent.ACTION_VIEW, uri)
            }
            startActivity(intent)
        } catch (_: Exception) {
            if (rawUrl.startsWith("intent:", ignoreCase = true)) {
                val fallback = runCatching {
                    Intent.parseUri(rawUrl, Intent.URI_INTENT_SCHEME).getStringExtra("browser_fallback_url")
                }.getOrNull()
                if (!fallback.isNullOrBlank()) {
                    openInCustomTab(Uri.parse(fallback))
                    return
                }
            }
            Toast.makeText(this, "App not installed on this device.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun launchPhotoPicker(includeCamera: Boolean) {
        val callback = pendingFileCallback ?: return
        try {
            val initialIntents = mutableListOf<Intent>()
            if (includeCamera) {
                val photosDir = File(cacheDir, "photos").apply { mkdirs() }
                val photoFile = File.createTempFile("proof_", ".jpg", photosDir)
                val photoUri = FileProvider.getUriForFile(
                    this,
                    "$packageName.fileprovider",
                    photoFile,
                )
                val captureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                    putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
                    addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                if (captureIntent.resolveActivity(packageManager) != null) {
                    pendingCameraFile = photoFile
                    pendingCameraUri = photoUri
                    initialIntents.add(captureIntent)
                } else {
                    photoFile.delete()
                }
            }

            val galleryIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "image/*"
            }

            val chooser = Intent(Intent.ACTION_CHOOSER).apply {
                putExtra(Intent.EXTRA_INTENT, galleryIntent)
                putExtra(Intent.EXTRA_TITLE, "Add chore photo")
                if (initialIntents.isNotEmpty()) {
                    putExtra(Intent.EXTRA_INITIAL_INTENTS, initialIntents.toTypedArray())
                }
            }

            fileChooserLauncher.launch(chooser)
        } catch (_: Exception) {
            pendingCameraFile?.delete()
            pendingCameraFile = null
            pendingCameraUri = null
            pendingFileCallback = null
            callback.onReceiveValue(null)
            Toast.makeText(this, "Could not open camera or photo picker.", Toast.LENGTH_SHORT).show()
        }
    }

    inner class AndroidJsBridge {
        @JavascriptInterface
        fun share(title: String?, text: String?, url: String?) {
            runOnUiThread {
                val body = listOfNotNull(
                    text?.takeIf { it.isNotBlank() },
                    url?.takeIf { it.isNotBlank() },
                ).joinToString("\n")
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    if (!title.isNullOrBlank()) putExtra(Intent.EXTRA_SUBJECT, title)
                    putExtra(Intent.EXTRA_TEXT, body)
                }
                try {
                    startActivity(Intent.createChooser(shareIntent, title ?: "Share Chorepot invite"))
                } catch (_: ActivityNotFoundException) {
                    Toast.makeText(this@MainActivity, "No sharing app found.", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}

@Composable
private fun LoadingSplashOverlay(progress: Int) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ChorepotCream)
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.widthIn(max = 280.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Image(
                painter = painterResource(id = R.drawable.chorepot_logo),
                contentDescription = "Chorepot icon",
                modifier = Modifier
                    .size(84.dp)
                    .clip(RoundedCornerShape(22.dp)),
            )
            Text(
                text = "Chorepot",
                fontSize = 26.sp,
                fontWeight = FontWeight.ExtraBold,
                color = ChorepotEmerald,
            )
            Text(
                text = "Loading your family space…",
                fontSize = 14.sp,
                color = ChorepotSlate,
                textAlign = TextAlign.Center,
            )
            LinearProgressIndicator(
                progress = { (progress.coerceIn(10, 100)) / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(999.dp)),
                color = ChorepotEmerald,
                trackColor = Color(0xFFE1ECE7),
            )
        }
    }
}

@Composable
private fun OfflineRetryOverlay(onRetry: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ChorepotCream)
            .padding(28.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.widthIn(max = 320.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Image(
                painter = painterResource(id = R.drawable.chorepot_logo),
                contentDescription = "Chorepot icon",
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(18.dp)),
            )
            Text(
                text = "You’re offline",
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color(0xFF1E2925),
            )
            Text(
                text = "Check your Wi-Fi or mobile data connection and tap below to reconnect to your family.",
                fontSize = 14.sp,
                color = ChorepotSlate,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(6.dp))
            Button(
                onClick = onRetry,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = ChorepotEmerald),
            ) {
                Text(text = "Try again", fontWeight = FontWeight.Bold)
            }
        }
    }
}
