using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Focus.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RewardsAndPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PlaybackJson",
                table: "Settings",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "ExtensionSeconds",
                table: "Blocks",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "RefocusUntilMs",
                table: "Blocks",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "StarterTargetSeconds",
                table: "Blocks",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Coins",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TimerBlockId = table.Column<int>(type: "INTEGER", nullable: true),
                    StudyDayId = table.Column<int>(type: "INTEGER", nullable: true),
                    Units = table.Column<long>(type: "INTEGER", nullable: false),
                    VerifiedMs = table.Column<long>(type: "INTEGER", nullable: false),
                    QualifyingCompletion = table.Column<bool>(type: "INTEGER", nullable: false),
                    BonusCoins = table.Column<int>(type: "INTEGER", nullable: false),
                    PurchaseKey = table.Column<Guid>(type: "TEXT", nullable: true),
                    PlantKey = table.Column<string>(type: "TEXT", nullable: true),
                    Slot = table.Column<int>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Coins", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Coins_Blocks_TimerBlockId",
                        column: x => x.TimerBlockId,
                        principalTable: "Blocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.UpdateData(
                table: "Settings",
                keyColumn: "Id",
                keyValue: 1,
                column: "PlaybackJson",
                value: "{}");

            migrationBuilder.CreateIndex(
                name: "IX_Coins_PurchaseKey",
                table: "Coins",
                column: "PurchaseKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Coins_Slot",
                table: "Coins",
                column: "Slot",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Coins_TimerBlockId",
                table: "Coins",
                column: "TimerBlockId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Coins");

            migrationBuilder.DropColumn(
                name: "PlaybackJson",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "ExtensionSeconds",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "RefocusUntilMs",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "StarterTargetSeconds",
                table: "Blocks");
        }
    }
}
