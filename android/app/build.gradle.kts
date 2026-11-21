import java.util.Properties

plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.compose.compiler)
}

val keystoreProps = Properties().apply {
  val propsFile = rootProject.file("keystore.properties")
  if (propsFile.exists()) {
    propsFile.inputStream().use(::load)
  }
}

android {
  namespace = "app.chorepot.family"
  compileSdk = 37
  defaultConfig {
    applicationId = "app.chorepot.family"
    minSdk = 26
    targetSdk = 35
    versionCode = 2
    versionName = "1.0.1"
  }

  signingConfigs {
    val storePath = System.getenv("CHOREPOT_STORE_FILE") ?: keystoreProps.getProperty("storeFile")
    val storePass = System.getenv("CHOREPOT_STORE_PASSWORD") ?: keystoreProps.getProperty("storePassword")
    val keyAliasVal = System.getenv("CHOREPOT_KEY_ALIAS") ?: keystoreProps.getProperty("keyAlias")
    val keyPassVal = System.getenv("CHOREPOT_KEY_PASSWORD") ?: keystoreProps.getProperty("keyPassword")
    if (!storePath.isNullOrBlank() && !storePass.isNullOrBlank() && !keyAliasVal.isNullOrBlank() && !keyPassVal.isNullOrBlank()) {
      create("release") {
        storeFile = file(storePath)
        storePassword = storePass
        keyAlias = keyAliasVal
        keyPassword = keyPassVal
      }
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = true
      isShrinkResources = true
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
      signingConfig = signingConfigs.findByName("release")
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  buildFeatures {
    compose = true
    aidl = false
    buildConfig = false
    shaders = false
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }
}

kotlin {
  jvmToolchain(21)
}

dependencies {
  val composeBom = platform(libs.androidx.compose.bom)
  implementation(composeBom)

  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.browser)
  implementation(libs.androidx.lifecycle.runtime.ktx)
  implementation(libs.androidx.activity.compose)

  implementation(libs.androidx.compose.ui)
  implementation(libs.androidx.compose.ui.tooling.preview)
  implementation(libs.androidx.compose.material3)
  debugImplementation(libs.androidx.compose.ui.tooling)

  testImplementation(libs.junit)
}
