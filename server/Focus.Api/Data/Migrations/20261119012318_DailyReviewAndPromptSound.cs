using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Focus.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class DailyReviewAndPromptSound : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "PromptSound",
                table: "Settings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "DailyNotes",
                columns: table => new
                {
                    Date = table.Column<string>(type: "TEXT", nullable: false),
                    Note = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyNotes", x => x.Date);
                });

            migrationBuilder.UpdateData(
                table: "Settings",
                keyColumn: "Id",
                keyValue: 1,
                column: "PromptSound",
                value: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DailyNotes");

            migrationBuilder.DropColumn(
                name: "PromptSound",
                table: "Settings");
        }
    }
}
