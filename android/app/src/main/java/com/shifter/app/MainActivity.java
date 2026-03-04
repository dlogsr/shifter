package com.shifter.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {

    private static final String TAG = "Shifter";
    private static final int FILE_CHOOSER_REQUEST = 1001;

    private WebView webView;
    private ValueCallback<Uri[]> fileUploadCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        // Serve local assets from a virtual HTTPS origin so fetch(), import(),
        // CORS, and localStorage all work correctly
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        // WebView settings
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        // Enable WebGL via hardware acceleration
        webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);

        // JavaScript bridge for blob downloads
        webView.addJavascriptInterface(new BlobDownloader(), "AndroidBlobDownloader");

        // Intercept requests to serve local assets
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view,
                    WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectBlobDownloadOverride(view);
            }
        });

        // Handle file upload chooser (for image picker)
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = callback;

                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    fileUploadCallback = null;
                    Toast.makeText(MainActivity.this,
                            "Cannot open file chooser", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    /**
     * Inject JS to intercept blob downloads and route them through our native bridge.
     *
     * Wraps URL.createObjectURL to track blob→URL mappings, then wraps
     * HTMLAnchorElement.click to detect blob download anchors and convert
     * them to base64 for native file saving.
     */
    private void injectBlobDownloadOverride(WebView view) {
        String js =
            "(function() {" +
            "  if (window._blobDownloadPatched) return;" +
            "  window._blobDownloadPatched = true;" +
            "  var _blobUrlMap = new Map();" +
            "  var origCreateObjectURL = URL.createObjectURL.bind(URL);" +
            "  URL.createObjectURL = function(blob) {" +
            "    var url = origCreateObjectURL(blob);" +
            "    if (blob instanceof Blob) _blobUrlMap.set(url, blob);" +
            "    return url;" +
            "  };" +
            "  var origClick = HTMLAnchorElement.prototype.click;" +
            "  HTMLAnchorElement.prototype.click = function() {" +
            "    if (this.href && this.href.startsWith('blob:') && this.download) {" +
            "      var blob = _blobUrlMap.get(this.href);" +
            "      if (blob) {" +
            "        var filename = this.download;" +
            "        var mimeType = blob.type;" +
            "        var reader = new FileReader();" +
            "        reader.onload = function() {" +
            "          var base64 = reader.result.split(',')[1];" +
            "          AndroidBlobDownloader.saveFile(base64, filename, mimeType);" +
            "        };" +
            "        reader.readAsDataURL(blob);" +
            "        return;" +
            "      }" +
            "    }" +
            "    return origClick.call(this);" +
            "  };" +
            "})();";

        view.evaluateJavascript(js, null);
    }

    /**
     * Native bridge: receives base64-encoded blob data from JS and saves
     * to the device Downloads/Shifter/ folder.
     */
    class BlobDownloader {
        @JavascriptInterface
        public void saveFile(String base64Data, String filename, String mimeType) {
            try {
                byte[] data = Base64.decode(base64Data, Base64.DEFAULT);

                if (mimeType == null || mimeType.isEmpty()) {
                    if (filename.endsWith(".mp4")) mimeType = "video/mp4";
                    else if (filename.endsWith(".webm")) mimeType = "video/webm";
                    else if (filename.endsWith(".png")) mimeType = "image/png";
                    else mimeType = "application/octet-stream";
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // Android 10+: use MediaStore
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    values.put(MediaStore.Downloads.RELATIVE_PATH,
                            Environment.DIRECTORY_DOWNLOADS + "/Shifter");

                    Uri uri = getContentResolver().insert(
                            MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        OutputStream os = getContentResolver().openOutputStream(uri);
                        if (os != null) {
                            os.write(data);
                            os.close();
                        }
                    }
                } else {
                    // Android 8-9: direct file write
                    File dir = new File(
                            Environment.getExternalStoragePublicDirectory(
                                    Environment.DIRECTORY_DOWNLOADS), "Shifter");
                    dir.mkdirs();
                    File file = new File(dir, filename);
                    FileOutputStream fos = new FileOutputStream(file);
                    fos.write(data);
                    fos.close();
                    sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE,
                            Uri.fromFile(file)));
                }

                // Don't spam toasts for frame sequences
                if (!filename.startsWith("frame-")) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this,
                            "Saved: " + filename, Toast.LENGTH_SHORT).show());
                }

            } catch (Exception e) {
                Log.e(TAG, "Failed to save file: " + filename, e);
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "Save failed: " + e.getMessage(),
                        Toast.LENGTH_SHORT).show());
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileUploadCallback != null) {
                Uri[] result = null;
                if (resultCode == RESULT_OK && data != null) {
                    Uri uri = data.getData();
                    if (uri != null) {
                        result = new Uri[]{ uri };
                    }
                }
                fileUploadCallback.onReceiveValue(result);
                fileUploadCallback = null;
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
