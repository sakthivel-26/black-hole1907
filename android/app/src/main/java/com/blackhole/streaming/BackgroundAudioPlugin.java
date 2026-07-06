package com.blackhole.streaming;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundAudio")
public class BackgroundAudioPlugin extends Plugin {
    private static BackgroundAudioPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void handleNotificationAction(String action) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("action", action);
            instance.notifyListeners("notificationAction", data);
        }
    }

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        String title = call.getString("title", "Black Hole");
        String artist = call.getString("artist", "Unknown Artist");
        String imageUrl = call.getString("image", "");
        boolean isPlaying = call.getBoolean("isPlaying", false);

        try {
            Intent intent = new Intent("UPDATE_METADATA");
            intent.putExtra("title", title);
            intent.putExtra("artist", artist);
            intent.putExtra("image", imageUrl);
            intent.putExtra("isPlaying", isPlaying);
            getContext().sendBroadcast(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update notification metadata", e);
        }
    }
}
