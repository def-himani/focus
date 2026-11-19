using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Focus.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CoreTimer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Blocks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Mode = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    PlannedSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    StartedAt = table.Column<long>(type: "INTEGER", nullable: false),
                    EndedAt = table.Column<long>(type: "INTEGER", nullable: true),
                    LastObservedAt = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Blocks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Settings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    Mode = table.Column<string>(type: "TEXT", nullable: false),
                    FocusSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    BreakSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    Loop = table.Column<bool>(type: "INTEGER", nullable: false),
                    AutoBreak = table.Column<bool>(type: "INTEGER", nullable: false),
                    AutoFocus = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BlockInterval",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TimerBlockId = table.Column<int>(type: "INTEGER", nullable: false),
                    Start = table.Column<long>(type: "INTEGER", nullable: false),
                    End = table.Column<long>(type: "INTEGER", nullable: true),
                    Kind = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BlockInterval", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BlockInterval_Blocks_TimerBlockId",
                        column: x => x.TimerBlockId,
                        principalTable: "Blocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Settings",
                columns: new[] { "Id", "AutoBreak", "AutoFocus", "BreakSeconds", "FocusSeconds", "Loop", "Mode", "Revision" },
                values: new object[] { 1, true, true, 300, 2400, true, "focus", 0L });

            migrationBuilder.CreateIndex(
                name: "IX_BlockInterval_TimerBlockId",
                table: "BlockInterval",
                column: "TimerBlockId");

            migrationBuilder.CreateIndex(
                name: "IX_Blocks_Mode_EndedAt",
                table: "Blocks",
                columns: new[] { "Mode", "EndedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BlockInterval");

            migrationBuilder.DropTable(
                name: "Settings");

            migrationBuilder.DropTable(
                name: "Blocks");
        }
    }
}
