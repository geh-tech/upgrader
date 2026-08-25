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
                item.setId(rs.getInt("id"));
                item.setName(rs.getString("name"));
                item.setSlot(rs.getString("slot"));
                item.setArmor(rs.getInt("armor"));
                item.setDamage(rs.getInt("damage"));
                item.setRarity(rs.getString("rarity"));
                item.setBasePrice(rs.getInt("base_price"));
                item.setTextureUrl(rs.getString("texture_url"));
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
                item.setId(rs.getInt("id"));
                item.setName(rs.getString("name"));
                item.setSlot(rs.getString("slot"));
                item.setArmor(rs.getInt("armor"));
                item.setDamage(rs.getInt("damage"));
                item.setRarity(rs.getString("rarity"));
                item.setBasePrice(rs.getInt("base_price"));
                item.setTextureUrl(rs.getString("texture_url"));
                return item;
            }
        } catch (SQLException e) { e.printStackTrace(); }
        return null;
    }
}