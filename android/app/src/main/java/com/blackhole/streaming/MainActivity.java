package com.blackhole.streaming;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Request POST_NOTIFICATIONS permission on Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) 
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, 
                        new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        // Configure WebView settings for better background performance
        if (this.getBridge() != null && this.getBridge().getWebView() != null) {
            WebView webView = this.getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            
            // Allow media playback without user gesture (often helps background transitions)
            settings.setMediaPlaybackRequiresUserGesture(false);
            
            // Ensure mixed content is allowed if needed
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
        }
    }

    private void startBackgroundService() {
        try {
            Intent serviceIntent = new Intent(this, BackgroundAudioService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void stopBackgroundService() {
        try {
            Intent serviceIntent = new Intent(this, BackgroundAudioService.class);
            stopService(serviceIntent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // Stop service when app returns to foreground to clean up notification
        stopBackgroundService();

        if (this.getBridge() != null && this.getBridge().getWebView() != null) {
            this.getBridge().getWebView().onResume();
            this.getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onPause() {
        super.onPause(); 
        // Start background service only when app goes to background
        startBackgroundService();

        // Synchronously keep the WebView active to prevent audio freeze
        if (this.getBridge() != null && this.getBridge().getWebView() != null) {
            this.getBridge().getWebView().onResume();
            this.getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        // Ensure background service is running when fully stopped in background
        startBackgroundService();

        // Also keep WebView active when fully stopped in background
        if (this.getBridge() != null && this.getBridge().getWebView() != null) {
            this.getBridge().getWebView().onResume();
            this.getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onDestroy() {
        stopBackgroundService();
        super.onDestroy();
    }
}
