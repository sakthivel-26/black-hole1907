package com.blackhole.streaming;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
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
    }

    @Override
    public void onResume() {
        super.onResume();
        if (this.getBridge() != null && this.getBridge().getWebView() != null) {
            this.getBridge().getWebView().onResume();
            this.getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onPause() {
        super.onPause(); 
        
        // Force the WebView to stay active in the background to prevent audio pause
        if (this.getBridge() != null && this.getBridge().getWebView() != null) {
            this.getBridge().getWebView().onResume();
            this.getBridge().getWebView().resumeTimers();
        }
    }
}
