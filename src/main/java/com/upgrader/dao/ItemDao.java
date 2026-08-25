package com.upgrader.dao;

import com.upgrader.config.Database;
import com.upgrader.models.Item;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class ItemDao {
    public static List<Item> getAllItems() {
        List<Item> list = new ArrayList<>();
        try (Connection conn = Database.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT * FROM items")) {
            while (rs.next()) {
                Item item = new Item();
                item.id = rs.getInt("id");
                item.name = rs.getString("name");
                item.slot = rs.getString("slot");
                item.armor = rs.getInt("armor");
                item.damage = rs.getInt("damage");
                item.rarity = rs.getString("rarity");
                item.basePrice = rs.getInt("base_price");
                item.textureUrl = rs.getString("texture_url");
                list.add(item);
            }
        } catch (SQLException e) { e.printStackTrace(); }
        return list;
    }

    public static Item getItemById(int id) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT * FROM items WHERE id = ?")) {
            stmt.setInt(1, id);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                Item item = new Item();
                item.id = rs.getInt("id");
                item.name = rs.getString("name");
                item.slot = rs.getString("slot");
                item.armor = rs.getInt("armor");
                item.damage = rs.getInt("damage");
                item.rarity = rs.getString("rarity");
                item.basePrice = rs.getInt("base_price");
                item.textureUrl = rs.getString("texture_url");
                return item;
            }
        } catch (SQLException e) { e.printStackTrace(); }
        return null;
    }
}