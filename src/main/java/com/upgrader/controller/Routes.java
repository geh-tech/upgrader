package com.upgrader.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.upgrader.dao.UserDao;
import com.upgrader.models.User;
import com.upgrader.service.GameService;

import static spark.Spark.*;

public class Routes {
    private static final ObjectMapper mapper = new ObjectMapper();

    public static void init() {
        // Регистрация
        post("/api/register", (req, res) -> {
            User user = mapper.readValue(req.body(), User.class);
            if (UserDao.register(user)) {
                res.status(200);
                return "OK";
            } else {
                res.status(400);
                return "User exists";
            }
        });

        // Логин
        post("/api/login", (req, res) -> {
            User user = mapper.readValue(req.body(), User.class);
            User found = UserDao.login(user.getNickname(), user.getPassword());
            if (found != null) {
                req.session(true).attribute("user", found);
                res.status(200);
                return mapper.writeValueAsString(found);
            } else {
                res.status(401);
                return "Invalid credentials";
            }
        });

        // Логаут
        post("/api/logout", (req, res) -> {
            req.session().removeAttribute("user");
            return "OK";
        });

        // Профиль
        get("/api/profile", (req, res) -> {
            User user = req.session().attribute("user");
            if (user == null) { res.status(401); return "Unauthorized"; }
            User fresh = UserDao.getUserById(user.getId());
            return mapper.writeValueAsString(fresh);
        });

        // Инвентарь
        get("/api/inventory", (req, res) -> {
            User user = req.session().attribute("user");
            if (user == null) { res.status(401); return "Unauthorized"; }
            return mapper.writeValueAsString(GameService.getFullInventory(user.getId()));
        });

        // Экипировать
        post("/api/equip", (req, res) -> {
            User user = req.session().attribute("user");
            if (user == null) { res.status(401); return "Unauthorized"; }
            int invId = Integer.parseInt(req.queryParams("invId"));
            GameService.equipItem(user.getId(), invId);
            return "OK";
        });

        // Апгрейд
        post("/api/upgrade", (req, res) -> {
            User user = req.session().attribute("user");
            if (user == null) { res.status(401); return "Unauthorized"; }
            int invId = Integer.parseInt(req.queryParams("invId"));
            int chance = Integer.parseInt(req.queryParams("chance"));
            boolean success = GameService.upgradeItem(user.getId(), invId, chance);
            return success ? "Success" : "Failed";
        });

        // Создать бой (1v1)
        post("/api/battle/create", (req, res) -> {
            User user = req.session().attribute("user");
            if (user == null) { res.status(401); return "Unauthorized"; }
            int opponentId = Integer.parseInt(req.queryParams("opponentId"));
            int battleId = GameService.createBattle(user.getId(), opponentId);
            return "" + battleId;
        });

        // Ход в бою
        post("/api/battle/action", (req, res) -> {
            User user = req.session().attribute("user");
            if (user == null) { res.status(401); return "Unauthorized"; }
            int battleId = Integer.parseInt(req.queryParams("battleId"));
            int targetId = Integer.parseInt(req.queryParams("targetId"));
            GameService.performAction(battleId, user.getId(), targetId);
            return "OK";
        });

        // Статус боя
        get("/api/battle/status/:battleId", (req, res) -> {
            int battleId = Integer.parseInt(req.params("battleId"));
            Object status = GameService.getBattleStatus(battleId);
            if (status == null) { res.status(404); return "Not found"; }
            return mapper.writeValueAsString(status);
        });

        // Топ игроков
        get("/api/top", (req, res) -> {
            return mapper.writeValueAsString(UserDao.getTopPlayers(10));
        });
    }
}