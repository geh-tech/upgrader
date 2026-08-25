package com.upgrader;

import com.upgrader.config.Database;
import com.upgrader.controller.Routes;
import com.upgrader.service.TopService;

import static spark.Spark.*;

public class App {
    public static void main(String[] args) {
        port(getPort());
        Database.init();
        Database.loadItemsFromJson();
        TopService.startHourlyReward();
        staticFiles.location("/public");
        Routes.init();
        System.out.println("Сервер запущен на порту " + port());
    }

    private static int getPort() {
        String port = System.getenv("PORT");
        return port != null ? Integer.parseInt(port) : 4567;
    }
}