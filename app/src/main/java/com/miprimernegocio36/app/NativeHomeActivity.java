package com.miprimernegocio36.app;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.content.Intent;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.NumberFormat;
import java.util.Locale;

/**
 * Fase 2: vista nativa de prueba, conectada en solo lectura con la copia privada
 * del JSON anterior. No crea ni modifica productos/ventas y no sustituye la app actual.
 */
public class NativeHomeActivity extends Activity {
    private final int navy = Color.rgb(35, 66, 91);
    private final int earth = Color.rgb(186, 145, 98);
    private final int background = Color.rgb(247, 248, 250);
    private LinearLayout content;
    private String currentTab = "Inicio";
    private JSONObject data;
    private JSONArray products;
    private JSONArray sales;
    private JSONArray expenses;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        data = NativeDataStore.readLegacyData(this);
        products = data == null ? new JSONArray() : data.optJSONArray("products");
        sales = data == null ? new JSONArray() : data.optJSONArray("sales");
        expenses = data == null ? new JSONArray() : data.optJSONArray("expenses");
        if (products == null) products = new JSONArray();
        if (sales == null) sales = new JSONArray();
        if (expenses == null) expenses = new JSONArray();
        showScreen("Inicio");
    }

    private int dp(int value) { return (int)(value * getResources().getDisplayMetrics().density + 0.5f); }
    private TextView text(String value, int size, boolean bold, int color) {
        TextView t = new TextView(this); t.setText(value); t.setTextSize(size); t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        t.setPadding(dp(4), dp(5), dp(4), dp(5)); return t;
    }
    private LinearLayout column() {
        LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(dp(16), dp(12), dp(16), dp(12)); return l;
    }
    private Button button(String label, int color) {
        Button b = new Button(this); b.setText(label); b.setTextColor(Color.WHITE);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(color)); return b;
    }
    private String money(double amount) {
        String currency = "MXN";
        if (data != null && data.optJSONObject("settings") != null) currency = data.optJSONObject("settings").optString("currency", "MXN");
        try { return NumberFormat.getCurrencyInstance(new Locale("es", "MX")).format(amount) + " " + currency; }
        catch (Exception e) { return String.format(Locale.getDefault(), "%.2f %s", amount, currency); }
    }
    private double sumSales() {
        double total = 0;
        for (int i=0;i<sales.length();i++) { JSONObject s=sales.optJSONObject(i); if(s!=null) total += s.optDouble("saleTotal", s.optDouble("lineTotal", s.optDouble("price",0)*s.optDouble("qty",0))); }
        return total;
    }
    private double sumExpenses() {
        double total=0;
        for(int i=0;i<expenses.length();i++){ JSONObject e=expenses.optJSONObject(i); if(e!=null) total+=e.optDouble("amount", e.optDouble("total",0)); }
        return total;
    }
    private int lowStockCount() {
        int n=0; for(int i=0;i<products.length();i++){ JSONObject p=products.optJSONObject(i); if(p!=null && p.optDouble("stock",0)<=p.optDouble("minStock",0)) n++; } return n;
    }
    private void showScreen(String tab) {
        currentTab=tab;
        LinearLayout root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(background);
        LinearLayout header=new LinearLayout(this); header.setOrientation(LinearLayout.VERTICAL); header.setPadding(dp(20),dp(16),dp(20),dp(16)); header.setBackgroundColor(navy);
        header.addView(text("Mi Primer Negocio 36",22,true,Color.WHITE));
        header.addView(text("Vista nativa · Fase 2 · Solo lectura",13,false,Color.rgb(225,232,238)));
        root.addView(header);
        ScrollView scroll=new ScrollView(this); content=column(); scroll.addView(content); root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout nav=new LinearLayout(this); nav.setPadding(dp(5),dp(5),dp(5),dp(5)); nav.setBackgroundColor(Color.WHITE);
        for(String item:new String[]{"Inicio","Inventario"}) { Button b=new Button(this); b.setText(item); b.setTextSize(12); b.setTextColor(item.equals(tab)?navy:Color.DKGRAY); b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(item.equals(tab)?0xFFE3EAF0:Color.WHITE)); b.setOnClickListener(v->showScreen(item)); nav.addView(b,new LinearLayout.LayoutParams(0,dp(50),1)); }
        Button back=new Button(this); back.setText("Volver"); back.setTextSize(12); back.setOnClickListener(v->finish()); nav.addView(back,new LinearLayout.LayoutParams(0,dp(50),1));
        root.addView(nav); setContentView(root);
        if("Inicio".equals(tab)) showHome(); else showInventory();
    }
    private void showHome() {
        content.addView(text("Resumen del negocio",24,true,navy));
        if(data==null){ content.addView(text("Aún no hay una copia de datos disponible. Vuelve a la pantalla principal, espera a que cargue y abre de nuevo esta vista.",15,false,Color.rgb(150,65,65))); return; }
        metric("Productos registrados",String.valueOf(products.length()));
        metric("Productos con stock bajo",String.valueOf(lowStockCount()));
        metric("Ventas registradas",String.valueOf(sales.length()));
        metric("Importe de ventas guardadas",money(sumSales()));
        metric("Gastos registrados",money(sumExpenses()));
        content.addView(text("Esta pantalla consulta una copia de tus datos actuales. Por ahora es de solo lectura: los cambios se siguen haciendo en la aplicación principal.",14,false,Color.DKGRAY));
        Button go=button("Consultar inventario",earth); go.setOnClickListener(v->showScreen("Inventario")); content.addView(go);
    }
    private void metric(String label,String value){ LinearLayout card=column(); card.setBackgroundColor(Color.WHITE); card.addView(text(label,13,false,Color.DKGRAY)); card.addView(text(value,21,true,navy)); LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2); lp.bottomMargin=dp(10); content.addView(card,lp); }
    private void showInventory() {
        content.addView(text("Inventario",24,true,navy));
        content.addView(text("Productos reales · consulta de solo lectura",14,false,Color.DKGRAY));
        if(data==null){ content.addView(text("No se encontró la copia privada. Abre primero la pantalla principal y vuelve a intentarlo.",15,false,Color.rgb(150,65,65))); return; }
        if(products.length()==0){ content.addView(text("No hay productos registrados en la copia de datos.",15,false,Color.GRAY)); return; }
        for(int i=0;i<products.length();i++){
            JSONObject p=products.optJSONObject(i); if(p==null) continue;
            double stock=p.optDouble("stock",0), min=p.optDouble("minStock",0);
            LinearLayout card=column(); card.setBackgroundColor(Color.WHITE);
            card.addView(text(p.optString("name","Producto"),18,true,navy));
            card.addView(text("Existencias: "+stock,15,false,Color.DKGRAY));
            card.addView(text("Precio: "+money(p.optDouble("price",0)),15,false,Color.DKGRAY));
            card.addView(text("Stock mínimo: "+min,13,false,Color.GRAY));
            if(stock<=min) card.addView(text("⚠ Stock bajo",13,true,Color.rgb(160,65,65)));
            LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2); lp.bottomMargin=dp(10); content.addView(card,lp);
        }
    }
}
