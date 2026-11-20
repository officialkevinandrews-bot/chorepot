package app.chorepot.family

import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

enum class NavigationTarget {
    IN_APP,
    CUSTOM_TAB_OAUTH,
    EXTERNAL_APP,
    EXTERNAL_BROWSER,
}

object ChorepotUrls {
    const val BASE_URL = "https://tidy-tasks-pocket-pals.lovable.app"
    const val APP_HOST = "tidy-tasks-pocket-pals.lovable.app"
    const val CUSTOM_UA_TAG = "ChorepotAPK"
    const val OAUTH_CALLBACK_SCHEME = "chorepot"
    const val OAUTH_CALLBACK_HOST = "oauth-callback"

    private val externalSchemes = setOf("mailto", "tel", "sms", "whatsapp", "intent")
    private val externalAppHosts = setOf("wa.me", "api.whatsapp.com", "chat.whatsapp.com")

    fun classifyNavigation(rawUrl: String): NavigationTarget {
        if (rawUrl.isBlank()) return NavigationTarget.IN_APP
        val lower = rawUrl.trim().lowercase()
        if (lower.startsWith("about:") || lower.startsWith("data:") || lower.startsWith("blob:")) {
            return NavigationTarget.IN_APP
        }

        val uri = runCatching { URI(rawUrl.trim()) }.getOrNull() ?: return NavigationTarget.EXTERNAL_BROWSER
        val scheme = uri.scheme?.lowercase().orEmpty()
        val host = uri.host?.lowercase().orEmpty()
        val path = uri.path?.lowercase().orEmpty()

        if (scheme in externalSchemes || host in externalAppHosts) {
            return NavigationTarget.EXTERNAL_APP
        }

        if (scheme != "http" && scheme != "https") {
            return NavigationTarget.EXTERNAL_APP
        }

        if (host == APP_HOST && (path.startsWith("/~oauth") || path.startsWith("/oauth"))) {
            return NavigationTarget.CUSTOM_TAB_OAUTH
        }

        if (host == "oauth.lovable.app" || host == "accounts.google.com") {
            return NavigationTarget.CUSTOM_TAB_OAUTH
        }

        if ((host == "lovable.dev" || host.endsWith(".lovable.dev")) &&
            (path.contains("oauth") || path.contains("login"))
        ) {
            return NavigationTarget.CUSTOM_TAB_OAUTH
        }

        if (scheme == "https" && host == APP_HOST && path.endsWith(".apk")) {
            return NavigationTarget.EXTERNAL_BROWSER
        }

        if (scheme == "https" && host == APP_HOST) {
            return NavigationTarget.IN_APP
        }

        return NavigationTarget.EXTERNAL_BROWSER
    }

    fun buildWebReturnUrlFromOAuthUri(rawCallbackUrl: String?): String? {
        if (rawCallbackUrl.isNullOrBlank()) return null
        val uri = runCatching { URI(rawCallbackUrl.trim()) }.getOrNull() ?: return null
        if (!uri.scheme.equals(OAUTH_CALLBACK_SCHEME, ignoreCase = true) ||
            !uri.host.equals(OAUTH_CALLBACK_HOST, ignoreCase = true)
        ) {
            return null
        }

        val params = LinkedHashMap<String, String>()
        parseFormParams(uri.rawQuery, params)
        parseFormParams(uri.rawFragment, params)

        val err = params["error_description"] ?: params["error"]
        if (!err.isNullOrBlank()) {
            return "$BASE_URL/auth?apk_oauth_error=${encode(err)}"
        }

        val accessToken = params["access_token"] ?: params["apk_access_token"]
        val refreshToken = params["refresh_token"] ?: params["apk_refresh_token"]
        if (!accessToken.isNullOrBlank() && !refreshToken.isNullOrBlank()) {
            return "$BASE_URL/auth#apk_access_token=${encode(accessToken)}&apk_refresh_token=${encode(refreshToken)}"
        }

        return null
    }

    private fun parseFormParams(raw: String?, out: MutableMap<String, String>) {
        if (raw.isNullOrBlank()) return
        for (pair in raw.split("&")) {
            if (pair.isEmpty()) continue
            val idx = pair.indexOf('=')
            val key = decode(if (idx >= 0) pair.substring(0, idx) else pair)
            val value = if (idx >= 0) decode(pair.substring(idx + 1)) else ""
            if (key.isNotEmpty()) {
                out[key] = value
            }
        }
    }

    private fun decode(value: String): String =
        URLDecoder.decode(value, StandardCharsets.UTF_8)

    private fun encode(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8)
}
