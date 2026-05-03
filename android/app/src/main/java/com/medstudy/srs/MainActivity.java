package com.medstudy.srs;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Per Capacitor docs (https://capacitorjs.com/docs/plugins/android), custom
        // plugins must be registered BEFORE super.onCreate so they are picked up
        // when the Bridge initializes inside super.onCreate.
        registerPlugin(TtsInstallerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
