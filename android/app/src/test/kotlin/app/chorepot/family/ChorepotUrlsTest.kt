package app.chorepot.family

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ChorepotUrlsTest {
    @Test
    fun classifiesInAppAndOAuthAndExternalRoutes() {
        assertEquals(
            NavigationTarget.IN_APP,
            ChorepotUrls.classifyNavigation("https://tidy-tasks-pocket-pals.lovable.app/dashboard"),
        )
        assertEquals(
            NavigationTarget.IN_APP,
            ChorepotUrls.classifyNavigation("https://tidy-tasks-pocket-pals.lovable.app/auth?code=FAM246"),
        )
        assertEquals(
            NavigationTarget.CUSTOM_TAB_OAUTH,
            ChorepotUrls.classifyNavigation("https://tidy-tasks-pocket-pals.lovable.app/~oauth/initiate?provider=google"),
        )
        assertEquals(
            NavigationTarget.CUSTOM_TAB_OAUTH,
            ChorepotUrls.classifyNavigation("https://accounts.google.com/o/oauth2/v2/auth"),
        )
        assertEquals(
            NavigationTarget.CUSTOM_TAB_OAUTH,
            ChorepotUrls.classifyNavigation("https://oauth.lovable.app/initiate?provider=google"),
        )
        assertEquals(
            NavigationTarget.EXTERNAL_APP,
            ChorepotUrls.classifyNavigation("https://wa.me/?text=hello"),
        )
        assertEquals(
            NavigationTarget.EXTERNAL_BROWSER,
            ChorepotUrls.classifyNavigation("https://tidy-tasks-pocket-pals.lovable.app/downloads/chorepot.apk"),
        )
        assertEquals(
            NavigationTarget.EXTERNAL_APP,
            ChorepotUrls.classifyNavigation("mailto:parent@example.com?subject=Join"),
        )
    }

    @Test
    fun buildsApkReturnUrlFromOAuthFragmentOrError() {
        val okUrl = ChorepotUrls.buildWebReturnUrlFromOAuthUri(
            "chorepot://oauth-callback#access_token=tok+1&refresh_token=ref%2F2",
        )
        assertEquals(
            "https://tidy-tasks-pocket-pals.lovable.app/auth#apk_access_token=tok+1&apk_refresh_token=ref%2F2",
            okUrl,
        )

        val errUrl = ChorepotUrls.buildWebReturnUrlFromOAuthUri(
            "chorepot://oauth-callback?error=access_denied",
        )
        assertEquals(
            "https://tidy-tasks-pocket-pals.lovable.app/auth?apk_oauth_error=access_denied",
            errUrl,
        )

        assertNull(ChorepotUrls.buildWebReturnUrlFromOAuthUri("https://example.com/other"))
    }
}
