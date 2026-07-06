package com.blackhole.streaming;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class BackgroundAudioService extends Service {
    private static final String CHANNEL_ID = "BackgroundAudioChannel";
    private static final int NOTIFICATION_ID = 1012;
    private MediaSession mediaSession;
    private PowerManager.WakeLock wakeLock;

    private String currentTitle = "Black Hole";
    private String currentArtist = "Playing audio in background";
    private String currentImageUrl = "";
    private boolean currentIsPlaying = false;
    private Bitmap currentAlbumArt = null;

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (action != null) {
                if ("ACTION_PLAY".equals(action)) {
                    BackgroundAudioPlugin.handleNotificationAction("play");
                    currentIsPlaying = true;
                    updatePlaybackState(true);
                    updateNotification();
                } else if ("ACTION_PAUSE".equals(action)) {
                    BackgroundAudioPlugin.handleNotificationAction("pause");
                    currentIsPlaying = false;
                    updatePlaybackState(false);
                    updateNotification();
                } else if ("ACTION_NEXT".equals(action)) {
                    BackgroundAudioPlugin.handleNotificationAction("next");
                } else if ("ACTION_PREVIOUS".equals(action)) {
                    BackgroundAudioPlugin.handleNotificationAction("prev");
                } else if ("UPDATE_METADATA".equals(action)) {
                    String title = intent.getStringExtra("title");
                    String artist = intent.getStringExtra("artist");
                    String imageUrl = intent.getStringExtra("image");
                    boolean isPlaying = intent.getBooleanExtra("isPlaying", false);

                    if (title != null) currentTitle = title;
                    if (artist != null) currentArtist = artist;
                    currentIsPlaying = isPlaying;
                    updatePlaybackState(isPlaying);

                    if (imageUrl != null && !imageUrl.equals(currentImageUrl)) {
                        currentImageUrl = imageUrl;
                        currentAlbumArt = null;
                        downloadBitmap(imageUrl);
                    } else {
                        updateNotification();
                    }
                }
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        // 1. Acquire WakeLock to keep CPU active for background WebView
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BlackHole::AudioWakeLock");
                wakeLock.acquire();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }


        // 3. Initialize native MediaSession so the OS recognises active media
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try {
                mediaSession = new MediaSession(this, "BlackHoleMediaSession");
                mediaSession.setActive(true);
                updatePlaybackState(currentIsPlaying);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        // 4. Register broadcast receiver for notification button clicks & metadata updates
        IntentFilter filter = new IntentFilter();
        filter.addAction("ACTION_PLAY");
        filter.addAction("ACTION_PAUSE");
        filter.addAction("ACTION_NEXT");
        filter.addAction("ACTION_PREVIOUS");
        filter.addAction("UPDATE_METADATA");
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(receiver, filter);
        }
    }

    private void updatePlaybackState(boolean isPlaying) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && mediaSession != null) {
            PlaybackState.Builder stateBuilder = new PlaybackState.Builder()
                    .setState(isPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1.0f)
                    .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS);
            mediaSession.setPlaybackState(stateBuilder.build());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        updateNotification();
        return START_STICKY;
    }

    private void updateNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 
                0, 
                notificationIntent, 
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );

        Intent prevIntent = new Intent("ACTION_PREVIOUS");
        prevIntent.setPackage(getPackageName());
        PendingIntent prevPendingIntent = PendingIntent.getBroadcast(this, 1, prevIntent, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        Intent playPauseIntent = new Intent(currentIsPlaying ? "ACTION_PAUSE" : "ACTION_PLAY");
        playPauseIntent.setPackage(getPackageName());
        PendingIntent playPausePendingIntent = PendingIntent.getBroadcast(this, 2, playPauseIntent, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        Intent nextIntent = new Intent("ACTION_NEXT");
        nextIntent.setPackage(getPackageName());
        PendingIntent nextPendingIntent = PendingIntent.getBroadcast(this, 3, nextIntent, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setAutoCancel(false);

        if (currentAlbumArt != null) {
            builder.setLargeIcon(currentAlbumArt);
        }

        // Add media action controls
        builder.addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_previous, "Previous", prevPendingIntent).build());
        builder.addAction(new Notification.Action.Builder(
                currentIsPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, 
                currentIsPlaying ? "Pause" : "Play", playPausePendingIntent).build());
        builder.addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_next, "Next", nextPendingIntent).build());

        // Apply MediaStyle decoration
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && mediaSession != null) {
            builder.setStyle(new Notification.MediaStyle()
                    .setMediaSession((MediaSession.Token) mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2));
        }

        Notification notification = builder.build();

        if (currentIsPlaying) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } else {
            // Stop foreground service state but retain dismissible notification in the tray
            stopForeground(false);
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.notify(NOTIFICATION_ID, notification);
            }
        }
    }

    private void downloadBitmap(final String urlStr) {
        if (urlStr == null || urlStr.isEmpty()) return;
        
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String fullUrl = urlStr;
                    if (fullUrl.startsWith("//")) {
                        fullUrl = "https:" + fullUrl;
                    }
                    
                    URL url = new URL(fullUrl);
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setDoInput(true);
                    connection.connect();
                    InputStream input = connection.getInputStream();
                    final Bitmap bitmap = BitmapFactory.decodeStream(input);
                    
                    new Handler(Looper.getMainLooper()).post(new Runnable() {
                        @Override
                        public void run() {
                            currentAlbumArt = bitmap;
                            updateNotification();
                        }
                    });
                } catch (Exception e) {
                    e.printStackTrace();
                    new Handler(Looper.getMainLooper()).post(new Runnable() {
                        @Override
                        public void run() {
                            updateNotification();
                        }
                    });
                }
            }
        }).start();
    }

    @Override
    public void onDestroy() {
        // Unregister broadcast receiver
        try {
            unregisterReceiver(receiver);
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Release WakeLock
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }


        // Release MediaSession
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Black Hole Background Audio",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }
}
