package com.miprimernegocio36.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Base inicial de la interfaz nativa de Mi Primer Negocio 36.
 * No reemplaza todavía la aplicación actual ni migra sus datos web.
 */
public class NativeHomeActivity extends Activity {
    private static final String PREFS = "mpn36_native_v1";
    private static final String KEY_PRODUCTS = "inventory_products";
    private LinearLayout content;
    private String currentTab = "Inicio";
    private final int navy = Color.rgb(28, 55, 82);
    private final int earth = Color.rgb(186, 145, 98);
    private final int background = Color.rgb(247, 248, 250);

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showScreen("Inicio");
    }

    private int dp(int value) { return (int)(value * getResources().getDisplayMetrics().density + 0.5f); }

    private TextView text(String value, int size, boolean bold, int color) {
        TextView t = new TextView(this);
        t.setText(value); t.setTextSize(size); t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        t.setPadding(dp(4), dp(5), dp(4), dp(5));
        return t;
    }

    private LinearLayout column() {
        LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(dp(16), dp(12), dp(16), dp(12)); return l;
    }

    private Button button(String label, int color) {
        Button b = new Button(this); b.setText(label); b.setTextColor(Color.WHITE);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(color));
        return b;
    }

    private void showScreen(String tab) {
        currentTab = tab;
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(background);
        LinearLayout header = new LinearLayout(this); header.setOrientation(LinearLayout.VERTICAL);
        header.setPadding(dp(20), dp(18), dp(20), dp(18)); header.setBackgroundColor(navy);
        TextView title = text("Mi Primer Negocio 36", 22, true, Color.WHITE);
        TextView subtitle = text("Gestión de tu negocio", 13, false, Color.rgb(225,232,238));
        header.addView(title); header.addView(subtitle); root.addView(header);
        ScrollView scroll = new ScrollView(this); content = column(); scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        LinearLayout nav = new LinearLayout(this); nav.setPadding(dp(6), dp(6), dp(6), dp(6)); nav.setBackgroundColor(Color.WHITE);
        String[] tabs = {"Inicio", "Inventario", "Ventas"};
        for (String item : tabs) {
            Button b = new Button(this); b.setText(item); b.setTextSize(12);
            b.setTextColor(item.equals(tab) ? navy : Color.DKGRAY);
            b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(item.equals(tab) ? 0xFFE3EAF0 : Color.WHITE));
            b.setOnClickListener(v -> showScreen(item));
            nav.addView(b, new LinearLayout.LayoutParams(0, dp(52), 1));
        }
        root.addView(nav); setContentView(root);
        if ("Inicio".equals(tab)) showHome();
        else if ("Inventario".equals(tab)) showInventory();
        else showSalesPlaceholder();
    }

    private void showHome() {
        content.addView(text("Resumen", 24, true, navy));
        content.addView(text("Esta es la base de la nueva interfaz Android nativa.", 15, false, Color.DKGRAY));
        content.addView(text("El inventario de esta versión inicial se guarda localmente en el dispositivo.", 14, false, Color.DKGRAY));
        Button go = button("Abrir inventario", earth); go.setOnClickListener(v -> showScreen("Inventario"));
        content.addView(go);
        content.addView(text("Importante: esta pantalla de prueba todavía no importa las ventas ni los productos de la versión web.", 13, false, Color.GRAY));
    }

    private JSONArray getProducts() {
        try { return new JSONArray(getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_PRODUCTS, "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }

    private void saveProducts(JSONArray products) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_PRODUCTS, products.toString()).apply();
    }

    private void showInventory() {
        content.addView(text("Inventario", 24, true, navy));
        content.addView(text("Registro nativo local de prueba", 14, false, Color.DKGRAY));
        Button add = button("+ Agregar producto", navy); add.setOnClickListener(v -> addProductDialog());
        content.addView(add);
        JSONArray products = getProducts();
        if (products.length() == 0) content.addView(text("Todavía no hay productos en este inventario de prueba.", 15, false, Color.GRAY));
        for (int i = 0; i < products.length(); i++) {
            JSONObject p = products.optJSONObject(i); if (p == null) continue;
            LinearLayout card = column(); card.setBackgroundColor(Color.WHITE);
            card.setPadding(dp(12), dp(10), dp(12), dp(10));
            card.addView(text(p.optString("name", "Producto"), 17, true, navy));
            card.addView(text("Existencias: " + p.optInt("stock", 0), 14, false, Color.DKGRAY));
            final int index = i;
            Button remove = button("Eliminar de la prueba", Color.rgb(160, 65, 65));
            remove.setOnClickListener(v -> { JSONArray updated = getProducts(); updated.remove(index); saveProducts(updated); showScreen("Inventario"); });
            card.addView(remove); LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2); lp.bottomMargin = dp(10); content.addView(card, lp);
        }
    }

    private void addProductDialog() {
        LinearLayout form = column();
        EditText name = new EditText(this); name.setSingleLine(true); name.setHint("Nombre del producto"); form.addView(name);
        EditText stock = new EditText(this); stock.setSingleLine(true); stock.setInputType(2); stock.setHint("Existencias iniciales"); form.addView(stock);
        new AlertDialog.Builder(this).setTitle("Nuevo producto")
            .setView(form).setNegativeButton("Cancelar", (d,w) -> {})
            .setPositiveButton("Guardar", (d,w) -> {
                String n = name.getText().toString().trim();
                if (n.isEmpty()) { new AlertDialog.Builder(this).setMessage("Escribe el nombre del producto.").setPositiveButton("Aceptar", null).show(); return; }
                int qty = 0; try { qty = Integer.parseInt(stock.getText().toString().trim()); } catch (Exception ignored) {}
                if (qty < 0) qty = 0;
                JSONArray products = getProducts(); JSONObject p = new JSONObject();
                try { p.put("name", n); p.put("stock", qty); products.put(p); } catch (Exception ignored) {}
                saveProducts(products); showScreen("Inventario");
            }).show();
    }

    private void showSalesPlaceholder() {
        content.addView(text("Ventas", 24, true, navy));
        content.addView(text("La pantalla de ventas nativa se implementará después de migrar y probar la lógica de ventas actual.", 15, false, Color.DKGRAY));
        content.addView(text("No registres ventas reales desde esta pantalla inicial.", 14, true, Color.rgb(150, 65, 65)));
    }
}
